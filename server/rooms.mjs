import {WebSocket} from 'ws';
import {createLocalRoomStore} from './local-room-store.mjs';
import {AccessToken,TrackSource} from 'livekit-server-sdk';
import {randomUUID,randomBytes} from 'node:crypto';
import {createMemoryStore,createRedisStore} from './room-store.mjs';
import {joinMember,applyMessage,disconnectMember,snapshot,finishSong,expireMembers,stateEvent,RESUME_GRACE_MS} from './room-state.mjs';
import {createYouTubeSearch,YouTubeSearchError} from './youtube-search.mjs';
import {createMovieCatalog} from './movie-catalog.mjs';
import {tickWerewolf} from './werewolf.mjs';

// The configured store owns room state: RAM with Redis checkpoints on a single
// server, or Redis transactions and Pub/Sub when multiple servers are required.
export function createRoomService({stateMode='shared',livekitUrl,livekitApiKey,livekitApiSecret,ice=[],store,redisUrl,redisPrefix,youtubeApiKey,movieCatalog=createMovieCatalog(),resumeGraceMs=RESUME_GRACE_MS,rotateAfterMs=0,heartbeatMs=20000,now=Date.now}={}){
 if(!store){const backend=redisUrl?createRedisStore({url:redisUrl,prefix:redisPrefix}):null;store=backend?(stateMode==='local'?createLocalRoomStore(backend):backend):createMemoryStore();}
 const searchYouTube=createYouTubeSearch({store,apiKey:youtubeApiKey,now});
 const livekit=!!(livekitUrl&&livekitApiKey&&livekitApiSecret);
 const clients=new Set(),channels=new Map();let stopping=false;
 function scheduleWerewolf(record,state){
  const channel=record.channel,g=state.werewolf,deadline=g?.until,version=deadline?g.id+':'+g.version:null;
  if(!channel||channel.werewolfVersion===version)return;channel.werewolfVersion=version;clearTimeout(channel.werewolfTimer);
  if(!version)return;
  const tick=()=>{
   if(stopping||!channel.clients.size||channel.werewolfVersion!==version)return;
   if(now()<deadline){channel.werewolfTimer=setTimeout(tick,deadline-now()+5);channel.werewolfTimer.unref?.();return;}
   store.transact(record.key,room=>({events:tickWerewolf(room,now())?[stateEvent(room,now())]:[]})).catch(()=>{if(channel.werewolfVersion===version){channel.werewolfTimer=setTimeout(tick,1000);channel.werewolfTimer.unref?.();}});
  };channel.werewolfTimer=setTimeout(tick,Math.max(10,deadline-now()));channel.werewolfTimer.unref?.();
 }
 function scheduleHost(record,state){
  const channel=record.channel;if(!channel)return;
  const deadline=state.hostReconnectUntil,version=Number.isFinite(deadline)?state.hostId+':'+deadline:null;
  if(channel.hostVersion===version)return;
  channel.hostVersion=version;clearTimeout(channel.hostTimer);
  if(!version)return;
  const expire=()=>{
   if(stopping||!channel.clients.size||channel.hostVersion!==version)return;
   if(deadline>now()){channel.hostTimer=setTimeout(expire,Math.ceil(deadline-now())+5);channel.hostTimer.unref?.();return;}
   store.transact(record.key,room=>({events:expireMembers(room,now())?[stateEvent(room,now())]:[]})).catch(()=>{
    if(channel.hostVersion===version){channel.hostTimer=setTimeout(expire,1000);channel.hostTimer.unref?.();}
   });
  };
  channel.hostTimer=setTimeout(expire,Math.max(10,deadline-now()));channel.hostTimer.unref?.();
 }
 function scheduleEnd(record,song){
  const channel=record.channel;if(!channel)return;
  const deadline=song&&!Number.isFinite(song.pausedAt)?song.endAt:null;
  const version=song&&Number.isFinite(deadline)?song.key+':'+deadline:null;
  if(channel.endVersion===version)return;
  channel.endVersion=version;clearTimeout(channel.endTimer);
  if(!version)return;
  const expire=()=>{
   if(stopping||!channel.clients.size||channel.endVersion!==version)return;
   if(deadline>now()){channel.endTimer=setTimeout(expire,Math.ceil(deadline-now())+5);channel.endTimer.unref?.();return;}
   store.transact(record.key,room=>finishSong(room,song.key,now())).catch(()=>{
    if(channel.endVersion===version){channel.endTimer=setTimeout(expire,1000);channel.endTimer.unref?.();}
   });
  };
  channel.endTimer=setTimeout(expire,Math.max(10,deadline-now()));channel.endTimer.unref?.();
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
   const floor=message.type==='state'?(record.stateRevision||0):record.revision;
   if(message.revision<floor)return;
   if(message.type==='state')record.stateRevision=message.revision;
   record.revision=Math.max(record.revision,message.revision);
  }
  if(message.type==='state'){record.song=message.song;record.hostId=message.hostId;record.mediaVersion=message.mediaVersion;scheduleEnd(record,message.song);scheduleHost(record,message);}
  if(message.type==='state')scheduleWerewolf(record,message);
  send(record,event.views?.[record.id]?{...message,...event.views[record.id]}:message);
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
   clearTimeout(channel.endTimer);clearTimeout(channel.hostTimer);clearTimeout(channel.werewolfTimer);
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
   console.warn('Room operation failed',{code:['ROOM_BUSY','STORE_UNAVAILABLE','STORE_CLOSED','ROOM_FULL'].includes(error.message)?error.message:'STORAGE_OPERATION_FAILED'});
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
   // Playback samples are ephemeral: never queue behind Redis movement writes.
   if(message.type==='video-position'){
    const song=record.song;
    if(record.ready&&song?.owner===record.id&&song.key===message.key&&message.start===song.start&&!Number.isFinite(song.pausedAt)&&Number.isFinite(message.position)&&message.position>=0&&message.position<=21600&&[1,2,3].includes(message.state)&&(!record.videoAt||now()-record.videoAt>=500)){
     record.videoAt=now();const event={message:{type:'video-position',key:song.key,start:song.start,position:message.position,state:message.state,at:now()}};
     for(const listener of record.channel.clients)if(listener!==record)receive(listener,event);
     if(!record.progressAt||now()-record.progressAt>=5000){
      record.progressAt=now();enqueue(async()=>{
       if(record.closed)return;
       const result=await store.transact(key,room=>applyMessage(room,record.id,record.connectionId,{...message,type:'video-progress'},now()));
       if(result.deadline)scheduleEnd(record,result.deadline);
      });
     }
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
   if(['movie-search','movie-detail','movie-select'].includes(message.type)){
    if(!record.ready||!record.id||typeof message.requestId!=='string'||! /^[\w-]{1,64}$/.test(message.requestId))return;
    const selecting=message.type==='movie-select';
    const reject=error=>send(record,selecting?{type:'control-result',requestId:message.requestId,accepted:false,error}:{type:'movie-result',requestId:message.requestId,error});
    if(record.movieBusy||now()-(record.movieAt||0)<500){reject('Chờ một chút rồi thử lại.');return;}
    if(selecting&&record.hostId!==record.id){reject('Chỉ chủ phòng mới chọn được phim.');return;}
    const expectedMediaVersion=record.mediaVersion;record.movieBusy=true;record.movieAt=now();
    const task=message.type==='movie-search'?movieCatalog.search(message.query):movieCatalog.detail(message.slug);
    task.then(async result=>{
     if(record.closed)return;
     if(!selecting){send(record,{type:'movie-result',requestId:message.requestId,...(message.type==='movie-search'?{items:result}:{detail:{...result,episodes:result.episodes.map(({source,...episode})=>episode)}})});return;}
     const episode=result.episodes.find(entry=>entry.id===message.episode);
     if(!episode){reject('Hãy chọn một tập phim hợp lệ.');return;}
     await enqueue(async()=>{
      if(record.closed)return;
      const resolvedMovie={slug:result.slug,title:result.title,episode:episode.name,server:episode.server,source:episode.source};
      const update=await store.transact(key,room=>applyMessage(room,record.id,record.connectionId,message,now(),{resolvedMovie,expectedMediaVersion}));
      if(update.expired){client.close(4001,'Session expired');return;}
      if(update.snapshot)receive(record,{message:update.snapshot});
      if(update.controlResult)send(record,{...update.controlResult,snapshot:update.snapshot});
     });
    }).catch(()=>{if(!record.closed)reject('Chưa tải được phim. Kiểm tra tên/link phim và thử lại.');}).finally(()=>record.movieBusy=false);
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
    if(slot.message.type==='voice-session'&&result.voice&&livekit){
     try{
     const voice=result.voice,token=new AccessToken(livekitApiKey,livekitApiSecret,{identity:record.id,ttl:'5m'});
     const singer=voice.group||voice.owner===record.id;
     token.addGrant({roomJoin:true,room:(voice.namespace==='werewolf'?'werewolf-':voice.group?'movie-':'karaoke-')+voice.key,canPublish:!!singer,...(singer?{canPublishSources:[TrackSource.MICROPHONE]}:{}),canSubscribe:true,canPublishData:false});
     send(record,{type:'voice-session',key:voice.key,url:livekitUrl,token:await token.toJwt()});
     }catch{send(record,{type:'error',message:'Chưa cấp được kết nối âm thanh. Kiểm tra cấu hình LiveKit trên máy chủ.'});}
    }
    if(result.snapshot)receive(record,{message:result.snapshot});
    if(result.queueResult)send(record,result.queueResult);
    if(result.controlResult)send(record,{...result.controlResult,snapshot:result.snapshot});
   });
  });
  client.on('close',(code,reason)=>{
   console.info('Room socket closed',{code,reason:reason.toString().slice(0,100),queued:record.queued});
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
    return {...joined,snapshot:snapshot(room,now(),joined.id)};
   });
   record.id=result.id;
   if(record.closed)return;
   send(record,{type:'hello',id:result.id,ice,voiceTransport:livekit?'livekit':'p2p',resumeToken:result.token});record.ready=true;
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
   for(const channel of channels.values()){clearTimeout(channel.endTimer);clearTimeout(channel.hostTimer);await channel.ready.then(stop=>stop()).catch(()=>{});}
   channels.clear();await store.close();
  },
 };
}
