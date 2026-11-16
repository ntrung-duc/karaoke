import {WebSocket} from 'ws';
import {randomUUID,randomBytes} from 'node:crypto';
import {createMemoryStore,createRedisStore} from './room-store.mjs';
import {joinMember,applyMessage,disconnectMember,snapshot,finishSong,RESUME_GRACE_MS} from './room-state.mjs';
import {createYouTubeSearch,YouTubeSearchError} from './youtube-search.mjs';

// Only socket ownership is local. Room membership, queues, poses and resume
// tokens live in the store, and committed events reach every subscribed instance.
export function createRoomService({ice=[],store,redisUrl,redisPrefix,youtubeApiKey,resumeGraceMs=RESUME_GRACE_MS,rotateAfterMs=0,heartbeatMs=20000,now=Date.now}={}){
 store??=redisUrl?createRedisStore({url:redisUrl,prefix:redisPrefix}):createMemoryStore();
 const searchYouTube=createYouTubeSearch({store,apiKey:youtubeApiKey,now});
 const clients=new Set(),channels=new Map();let stopping=false;
 function scheduleEnd(record,song){
  const channel=record.channel;if(!channel)return;
  const version=song&&!Number.isFinite(song.pausedAt)&&Number.isFinite(song.endAt)?song.key+':'+song.endAt:null;
  if(channel.endVersion===version)return;
  channel.endVersion=version;clearTimeout(channel.endTimer);
  if(!version)return;
  const expire=()=>{
   if(stopping||!channel.clients.size||channel.endVersion!==version)return;
   if(song.endAt>now()){channel.endTimer=setTimeout(expire,Math.ceil(song.endAt-now())+5);channel.endTimer.unref?.();return;}
   store.transact(record.key,room=>finishSong(room,song.key,now())).catch(()=>{
    if(channel.endVersion===version){channel.endTimer=setTimeout(expire,1000);channel.endTimer.unref?.();}
   });
  };
  channel.endTimer=setTimeout(expire,Math.max(10,song.endAt-now()));channel.endTimer.unref?.();
 }
 function send(record,message){
  if(record.client.readyState!==WebSocket.OPEN)return;
  if(record.client.bufferedAmount>262144){record.client.close(1013,'Slow connection');return;}
  record.client.send(JSON.stringify(message));
 }
 function receive(record,event){
  if(record.closed)return;
  if(!record.ready){if(record.buffer.length<256)record.buffer.push(event);else record.client.close(1013,'Reconnect');return;}
  if(event.takeover){
   if(event.takeover.id===record.id&&event.takeover.connectionId!==record.connectionId)record.client.close(4001,'Session opened elsewhere');
   return;
  }
  if(event.to&&event.to!==record.id)return;
  const message=event.message;if(!message)return;
  if(Number.isInteger(message.revision)){
   if(message.revision<record.revision)return;
   record.revision=message.revision;
  }
  if(message.type==='state')scheduleEnd(record,message.song);
  send(record,message);
 }
 async function subscribe(record){
  let channel=channels.get(record.key);
  if(channel?.closing){await channel.closing;return subscribe(record);}
  if(!channel){
   channel={clients:new Set()};channels.set(record.key,channel);
   channel.ready=store.subscribe(record.key,event=>{for(const client of channel.clients)receive(client,event);});
  }
  channel.clients.add(record);record.channel=channel;await channel.ready;
 }
 async function release(record){
  const channel=record.channel;if(!channel)return;
  channel.clients.delete(record);
  if(channel.clients.size===0&&channels.get(record.key)===channel){
   clearTimeout(channel.endTimer);
   channel.closing=(async()=>{
    const unsubscribe=await channel.ready;await unsubscribe();
   })().finally(()=>{if(channels.get(record.key)===channel)channels.delete(record.key);});
   await channel.closing;
  }
 }
 const stopUnavailable=store.onUnavailable(()=>{for(const record of clients)record.client.close(1013,'Room storage unavailable');});
 function join(client,key,resumeToken){
  const record={client,key,connectionId:randomUUID(),id:null,ready:false,closed:false,buffer:[],revision:0,pending:Promise.resolve(),queued:0,alive:true,moveSlot:null};
  clients.add(record);
  function fail(error){
   if(client.readyState===WebSocket.OPEN){send(record,{type:'error',message:error.message==='ROOM_FULL'?'Phòng đã đầy.':'Chưa kết nối được máy chủ phòng. Đang thử lại.'});client.close(1013,'Room unavailable');}
  }
  function enqueue(task){
   record.pending=record.pending.then(task).catch(fail);return record.pending;
  }
  client.on('error',()=>client.terminate());
  client.on('pong',()=>{record.alive=true;record.missedPongs=0;});
  client.on('message',raw=>{
   let message;try{message=JSON.parse(raw);}catch{return;}
   if(!message||typeof message!=='object'||record.closed)return;
   // Clock probes bypass Redis and command queues so storage load cannot bias RTT.
   if(message.type==='clock'){
    if(record.ready&&record.id&&Number.isSafeInteger(message.seq)&&message.seq>0&&(!record.clockAt||now()-record.clockAt>=100)){
     record.clockAt=now();send(record,{type:'clock',seq:message.seq,serverTime:now()});
    }
    return;
   }
   // Search runs independently so an upstream request never queues WASD/jump.
   if(message.type==='search'){
    if(!record.ready||!record.id||typeof message.requestId!=='string'||! /^[\w-]{1,64}$/.test(message.requestId)||record.searching)return;
    record.searching=true;
    searchYouTube(record.id,message.query,message.karaoke!==false).then(result=>{
     if(!record.closed)send(record,{type:'search-results',requestId:message.requestId,...result});
    }).catch(error=>{
     if(!record.closed)send(record,{type:'search-results',requestId:message.requestId,error:error instanceof YouTubeSearchError?error.message:'Chưa tìm được bài. Thử lại sau hoặc dán liên kết video.'});
    }).finally(()=>record.searching=false);
    return;
   }
   // Keep only the newest unsent pose while Redis is busy. Other commands
   // form barriers so a pose cannot overtake standing, jumping or sitting.
   if(message.type==='move'&&record.moveSlot){record.moveSlot.message=message;return;}
   const slot={message};record.moveSlot=message.type==='move'?slot:null;
   if(++record.queued>64){client.close(1008,'Too many messages');return;}
   enqueue(async()=>{
    record.queued--;if(record.closed||!record.id)return;
    if(record.moveSlot===slot)record.moveSlot=null;
    const result=await store.transact(key,room=>applyMessage(room,record.id,record.connectionId,slot.message,now()));
    if(result.expired)client.close(4001,'Session expired');
    if(result.snapshot)receive(record,{message:result.snapshot});
   });
  });
  client.on('close',()=>{
   record.closed=true;clearInterval(record.heartbeat);clearTimeout(record.rotation);
   enqueue(async()=>{
    if(record.id)await store.transact(key,room=>disconnectMember(room,record.id,record.connectionId,now(),resumeGraceMs));
   }).finally(async()=>{clients.delete(record);await release(record).catch(()=>{});});
  });
  return enqueue(async()=>{
   if(stopping||record.closed){client.close(1012,'Server restarting');return;}
   await subscribe(record);
   const id=randomUUID(),token=randomBytes(32).toString('base64url');
   const result=await store.transact(key,room=>{
    const joined=joinMember(room,{id,connectionId:record.connectionId,token,resumeToken},now());
    return {...joined,snapshot:snapshot(room,now())};
   });
   record.id=result.id;
   if(record.closed)return;
   send(record,{type:'hello',id:result.id,ice,resumeToken:result.token});record.ready=true;
   receive(record,{message:result.snapshot});for(const event of record.buffer.splice(0))receive(record,event);
   record.heartbeat=setInterval(()=>{
    if(!record.alive){record.missedPongs=(record.missedPongs||0)+1;if(record.missedPongs>=3){client.terminate();return;}}
    record.alive=false;client.ping();
    enqueue(async()=>{
     if(record.closed)return;
     const result=await store.transact(key,room=>applyMessage(room,record.id,record.connectionId,{type:'heartbeat'},now()));
     if(result.expired)client.close(4001,'Session expired');
     else if(result.snapshot)receive(record,{message:result.snapshot});
    });
   },heartbeatMs);record.heartbeat.unref?.();
   if(rotateAfterMs){record.rotation=setTimeout(()=>client.close(1012,'Refresh connection'),rotateAfterMs);record.rotation.unref?.();}
  });
 }
 return {
  join,ready:()=>store.ready(),
  async close(){
   stopping=true;stopUnavailable();
   const current=[...clients];for(const r of current){clearInterval(r.heartbeat);clearTimeout(r.rotation);r.client.terminate();}
   await Promise.all(current.map(r=>r.pending));
   for(const channel of channels.values()){clearTimeout(channel.endTimer);await channel.ready.then(stop=>stop()).catch(()=>{});}
   channels.clear();await store.close();
  },
 };
}
