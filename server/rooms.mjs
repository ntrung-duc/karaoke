import {WebSocket} from 'ws';
import {randomUUID,randomBytes} from 'node:crypto';
import {createMemoryStore,createRedisStore} from './room-store.mjs';
import {joinMember,applyMessage,disconnectMember,snapshot,RESUME_GRACE_MS} from './room-state.mjs';

// Only socket ownership is local. Room membership, queues, poses and resume
// tokens live in the store, and committed events reach every subscribed instance.
export function createRoomService({ice=[],store,redisUrl,redisPrefix,resumeGraceMs=RESUME_GRACE_MS,rotateAfterMs=0,heartbeatMs=20000,now=Date.now}={}){
 store??=redisUrl?createRedisStore({url:redisUrl,prefix:redisPrefix}):createMemoryStore();
 const clients=new Set(),channels=new Map();let stopping=false;
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
   channel.closing=(async()=>{
    const unsubscribe=await channel.ready;await unsubscribe();
   })().finally(()=>{if(channels.get(record.key)===channel)channels.delete(record.key);});
   await channel.closing;
  }
 }
 const stopUnavailable=store.onUnavailable(()=>{for(const record of clients)record.client.close(1013,'Room storage unavailable');});
 function join(client,key,resumeToken){
  const record={client,key,connectionId:randomUUID(),id:null,ready:false,closed:false,buffer:[],revision:0,pending:Promise.resolve(),queued:0,alive:true};
  clients.add(record);
  function fail(error){
   if(client.readyState===WebSocket.OPEN){send(record,{type:'error',message:error.message==='ROOM_FULL'?'Phòng đã đầy.':'Chưa kết nối được máy chủ phòng. Đang thử lại.'});client.close(1013,'Room unavailable');}
  }
  function enqueue(task){
   record.pending=record.pending.then(task).catch(fail);return record.pending;
  }
  client.on('error',()=>client.terminate());
  client.on('pong',()=>{record.alive=true;});
  client.on('message',raw=>{
   let message;try{message=JSON.parse(raw);}catch{return;}
   if(!message||typeof message!=='object'||record.closed)return;
   if(++record.queued>64){client.close(1008,'Too many messages');return;}
   enqueue(async()=>{
    record.queued--;if(record.closed||!record.id)return;
    const result=await store.transact(key,room=>applyMessage(room,record.id,record.connectionId,message,now()));
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
    if(!record.alive){client.terminate();return;}
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
   for(const channel of channels.values())await channel.ready.then(stop=>stop()).catch(()=>{});
   channels.clear();await store.close();
  },
 };
}
