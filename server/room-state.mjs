import {createHash,randomUUID} from 'node:crypto';
import {seats,position,clearSeat,floorHeight} from '../public/layout.js';
import {gaits,jumpPose} from '../public/motion.js';
import {MAX_QUEUE,MAX_NAME,MAX_TITLE,MAX_CHAT,MAX_CHAT_HISTORY} from '../public/session.js';
import {isFace,isSkin,wrapYaw,isShirt,shirtColor} from '../public/avatar-settings.js';
import {animalId,isAnimal} from '../public/animal-settings.js';
import {moviePosition} from '../public/movie-state.js';
import {createWerewolf,publicWerewolf,privateWerewolf,werewolfCommand,tickWerewolf,leaveWerewolf,werewolfVoice,chatChannel,readWerewolfChat,isWerewolfRunning} from './werewolf.mjs';

export const PRESENCE_MS=60000;
export const RESUME_GRACE_MS=45000;
const resetMotion={gait:'idle',movingUntil:0,jumpAt:0,emoteAt:0,emote:'parker'};
export const tokenDigest=token=>createHash('sha256').update(token).digest('hex');
export const emptyRoom=()=>({users:new Map(),queue:[],song:null,chat:[],revision:0,hostId:null,hostVersion:0,mode:'karaoke',mediaVersion:0,movie:null,movieVoiceKey:null,pendingMode:null,pendingMovie:null,werewolf:null});
export const encodeRoom=room=>JSON.stringify({...room,users:[...room.users]});
export const decodeRoom=raw=>{if(!raw)return emptyRoom();const value=JSON.parse(raw);if(value.song?.buffering){if(!Number.isFinite(value.song.pausedAt)&&value.song.duration)value.song.endAt=value.song.start+value.song.duration*1000;delete value.song.buffering;delete value.song.playhead;}return {...emptyRoom(),...value,chat:(value.chat||[]).slice(-MAX_CHAT_HISTORY),users:new Map(value.users)};};
export const snapshot=(room,now,id)=>({type:'state',werewolf:publicWerewolf(room),wwPrivate:id?privateWerewolf(room,id):null,mode:room.mode,mediaVersion:room.mediaVersion,movie:room.movie?{...room.movie}:null,movieVoiceKey:room.movieVoiceKey,pendingMode:room.pendingMode,pendingMovie:room.pendingMovie?{title:room.pendingMovie.title,episode:room.pendingMovie.episode}:null,hostId:room.hostId,hostVersion:room.hostVersion,hostReconnectUntil:room.hostId&&!room.users.get(room.hostId)?.connectionId?room.users.get(room.hostId)?.expiresAt??null:null,users:[...room.users.values()].map(u=>({...u.data,connected:!!u.connectionId&&u.expiresAt>now,animal:animalId(u.data.animal),animalChosen:!!u.animalChosen})),queue:room.queue.map(s=>({...s})),song:room.song?{...room.song,phase:room.song.awaitingStart?'ready':Number.isFinite(room.song.pausedAt)?'paused':'playing'}:null,chat:readWerewolfChat(room,id,room.chat||[]).slice(-MAX_CHAT_HISTORY).map(entry=>({...entry})),now,revision:room.revision});
export const stateEvent=(room,now)=>({message:snapshot(room,now),...(room.mode==='werewolf'?{views:Object.fromEntries([...room.users.keys()].map(id=>[id,{wwPrivate:privateWerewolf(room,id),chat:readWerewolfChat(room,id,room.chat||[])}]))}:{})});

// Map insertion order is the original join order and survives checkpoints.
// Resuming a session must not move it to the back of the succession order.
function ensureHost(room,now){
 const current=room.users.get(room.hostId);
 if(current&&current.expiresAt>now)return false;
 const next=[...room.users].find(([,member])=>member.connectionId&&member.expiresAt>now)?.[0]??null;
 if(room.hostId===next)return false;
 room.hostId=next;room.hostVersion++;return true;
}

function enterWerewolf(room,now){
 room.mode='werewolf';room.pendingMode=null;room.pendingMovie=null;room.song=null;room.movie=null;room.movieVoiceKey=null;room.werewolf=createWerewolf();
 for(const member of room.users.values())member.data.mic=false;
}
function enterMovies(room,now){
 room.mode='movie';room.pendingMode=null;room.song=null;room.movieVoiceKey=randomUUID();
 room.movie=room.pendingMovie?{...room.pendingMovie,position:0,paused:true,updatedAt:now}:null;room.pendingMovie=null;
 for(const member of room.users.values())member.data.mic=false;
}
function pauseEmptyMovie(room,now){
 if(room.mode==='movie'&&room.movie&&![...room.users.values()].some(member=>member.connectionId&&member.expiresAt>now)){
  room.movie.position=moviePosition(room.movie,now);room.movie.paused=true;room.movie.updatedAt=now;
 }
}
function advance(room,now){
 const previous=room.users.get(room.song?.owner)?.data;
 if(previous)Object.assign(previous,{x:-5.9,z:-.95,seat:-1,mic:false,yaw:0,bodyYaw:0,pitch:0,...resetMotion});
 if(room.pendingMode==='werewolf'){enterWerewolf(room,now);return;}
 if(room.pendingMode==='movie'){enterMovies(room,now);return;}
 if(room.mode==='movie'||room.mode==='werewolf')return;
 room.queue=room.queue.filter(entry=>room.users.has(entry.owner));
 const index=room.queue.findIndex(entry=>{const member=room.users.get(entry.owner);return member.connectionId&&member.expiresAt>now;});
 room.song=index<0?null:room.queue.splice(index,1)[0];
 if(room.song){
  room.song.start=now;
  room.song.pausedAt=now;
  room.song.awaitingStart=true;
  Object.assign(room.users.get(room.song.owner).data,{x:0,z:-4,seat:-1,yaw:Math.PI,bodyYaw:Math.PI,pitch:0,...resetMotion});
 }
}
export function removeMember(room,id,now){
 leaveWerewolf(room,id,now);room.users.delete(id);room.queue=room.queue.filter(song=>song.owner!==id);
 if(room.song?.owner===id)advance(room,now);
 ensureHost(room,now);
 pauseEmptyMovie(room,now);
}
export function expireMembers(room,now){
 const expired=[...room.users].filter(([,u])=>u.expiresAt<=now).map(([id])=>id);
 for(const id of expired)removeMember(room,id,now);
 const changedHost=ensureHost(room,now);
 return expired.length>0||changedHost;
}
export function finishSong(room,key,now){
 const expired=expireMembers(room,now);
 const due=room.song?.key===key&&!Number.isFinite(room.song.pausedAt)&&Number.isFinite(room.song.endAt)&&room.song.endAt<=now;
 if(due)advance(room,now);
 return {events:expired||due?[stateEvent(room,now)]:[]};
}
export function joinMember(room,{id,connectionId,token,resumeToken},now){
 expireMembers(room,now);
 const digest=resumeToken?tokenDigest(resumeToken):null;
 let member=digest?[...room.users.values()].find(u=>u.tokenDigest===digest):null;
 if(!member){
  if(room.users.size>=80)throw new Error('ROOM_FULL');
  const data={id,animal:'cat',name:'Khách',seat:-1,x:0,z:15,yaw:0,bodyYaw:0,pitch:0,face:0,skin:0,shirt:shirtColor(),color:Math.floor(Math.random()*6),mic:false,...resetMotion};
  member={data,tokenDigest:tokenDigest(token)};room.users.set(id,member);
 }else token=resumeToken;
 member.connectionId=connectionId;member.expiresAt=now+PRESENCE_MS;
 ensureHost(room,now);
 if(room.song?.bowUntil){advance(room,now);}else if(room.mode==='karaoke'&&!room.song&&room.queue.length)advance(room,now);
 return {id:member.data.id,token,events:[{takeover:{id:member.data.id,connectionId}},stateEvent(room,now)]};
}

// Pure state changes run again when Redis detects a concurrent writer. Socket
// sends and other external effects happen only after a successful commit.
export function applyMessage(room,id,connectionId,message,now,{resolvedMovie,expectedMediaVersion}={}){
 const events=[],member=room.users.get(id);
 if(!member||member.connectionId!==connectionId||member.expiresAt<=now)return {expired:true,events};
 member.expiresAt=now+PRESENCE_MS;
 const data=member.data,singer=room.song?.owner===id;
 const controlReply=(accepted,error)=>({events,snapshot:snapshot(room,now,id),controlResult:{type:'control-result',requestId:message.requestId,accepted,error}});
 if(typeof message.type==='string'&&message.type.startsWith('ww-')){
  const ticked=tickWerewolf(room,now);const error=werewolfCommand(room,id,message,now);if(ticked||!error)events.push(stateEvent(room,now));return controlReply(!error,error);
 }
 switch(message.type){
  case 'room-mode':{
   if(room.hostId!==id||message.hostVersion!==room.hostVersion)return controlReply(false,'Chỉ chủ phòng hiện tại mới đổi được chế độ.');
   if(isWerewolfRunning(room))return controlReply(false,'Hãy kết thúc ván Ma Sói trước khi đổi chế độ.');
   if(!['movie','karaoke','werewolf'].includes(message.mode))return controlReply(false,'Chế độ không hợp lệ.');
   room.mediaVersion++;
   if(message.mode==='werewolf'){if(room.mode!=='werewolf'){if(room.song)room.pendingMode='werewolf';else enterWerewolf(room,now);}}
   else if(message.mode==='movie'&&room.mode!=='movie'){
    if(room.song)room.pendingMode='movie';else enterMovies(room,now);
   }else if(message.mode==='karaoke'){
    room.pendingMode=null;room.pendingMovie=null;
    if(room.mode==='movie'||room.mode==='werewolf'){room.mode='karaoke';room.movie=null;room.movieVoiceKey=null;for(const member of room.users.values())member.data.mic=false;advance(room,now);}
   }
   events.push(stateEvent(room,now));return controlReply(true);
  }
  case 'movie-select':{
   if(room.hostId!==id||message.hostVersion!==room.hostVersion)return controlReply(false,'Quyền chủ phòng đã thay đổi. Hãy chọn lại phim.');
   if(isWerewolfRunning(room))return controlReply(false,'Hãy kết thúc ván Ma Sói trước khi chọn phim.');
   if(!resolvedMovie)return controlReply(false,'Chưa lấy được nguồn phim. Hãy chọn lại phim.');
   if(expectedMediaVersion!==undefined&&expectedMediaVersion!==room.mediaVersion)return controlReply(false,'Chế độ hoặc phim đã thay đổi trong lúc tải. Hãy chọn lại phim.');
   room.mediaVersion++;
   const movie={...resolvedMovie,key:randomUUID(),position:0,updatedAt:now,paused:true};
   if(room.mode==='movie')room.movie=movie;
   else{room.pendingMovie=movie;if(room.song)room.pendingMode='movie';else enterMovies(room,now);}
   events.push(stateEvent(room,now));return controlReply(true);
  }
  case 'movie-playback':{
   if(room.mode!=='movie'||room.hostId!==id||message.hostVersion!==room.hostVersion||room.movie?.key!==message.key)return controlReply(false,'Chỉ chủ phòng mới điều khiển được phim hiện tại.');
   if(typeof message.paused!=='boolean'||message.position!==undefined&&(!Number.isFinite(message.position)||message.position<0||message.position>86400))return controlReply(false,'Vị trí phim không hợp lệ.');
   room.movie.position=message.position??moviePosition(room.movie,now);room.movie.paused=message.paused;room.movie.updatedAt=now;
   events.push(stateEvent(room,now));return controlReply(true);
  }
  case 'movie-duration':
   if(room.mode!=='movie'||room.hostId!==id||room.movie?.key!==message.key||!Number.isFinite(message.duration)||message.duration<=0||message.duration>86400)return {events};
   if(room.movie.duration===message.duration)return {events};room.movie.duration=message.duration;break;
  case 'transfer-host':{
   if(room.hostId!==id)return controlReply(false,'Chỉ chủ phòng mới được trao quyền.');
   if(message.hostVersion!==room.hostVersion)return controlReply(false,'Quyền chủ phòng đã thay đổi. Hãy chọn lại người nhận.');
   const target=room.users.get(message.target);
   if(message.target===id||!target?.connectionId||target.expiresAt<=now)return controlReply(false,'Người nhận phải đang kết nối trong phòng.');
   room.hostId=message.target;room.hostVersion++;
   events.push(stateEvent(room,now));return controlReply(true);
  }
  case 'flower':{
   const singerData=room.users.get(room.song?.owner)?.data;
   if(!singerData||singer||message.key!==room.song.key)return {events};
   if(Number.isFinite(member.flowerAt)&&now-member.flowerAt<1200)return {events};
   member.flowerAt=now;
   const angle=Math.random()*Math.PI*2,radius=.6+Math.random()*1.1;
   const end=position(singerData.x+Math.cos(angle)*radius,singerData.z+Math.sin(angle)*radius,true);
   events.push({message:{type:'flower',id:randomUUID(),key:room.song.key,at:now,
    from:{x:data.x,y:(data.seat>=0?(seats[data.seat]?.y??0)+1.45:floorHeight(data.z,data.x)+1.2),z:data.z},to:{...end,y:1.08},revision:room.revision}});
   return {events};
  }
  case 'chat':{
   if(typeof message.text!=='string'||message.text.length>MAX_CHAT||typeof message.clientId!=='string'||! /^[\w-]{8,64}$/.test(message.clientId))return {events};
   const text=message.text.trim();if(!text)return {events};
   room.chat??=[];
   if(room.chat.some(entry=>entry.userId===id&&entry.clientId===message.clientId))return {events};
   if(Number.isFinite(member.chatAt)&&now-member.chatAt<500)return {events:[{to:id,message:{type:'error',message:'Bạn gửi hơi nhanh. Chờ một chút rồi gửi tiếp nhé.'}}]};
   member.chatAt=now;
   const channel=room.mode==='werewolf'?chatChannel(room,id):'public';
   if(!channel)return {events:[{to:id,message:{type:'error',message:'Ban đêm vai của bạn không được nhắn tin. Hãy chờ ban ngày.'}}]};
   const entry={id:randomUUID(),clientId:message.clientId,userId:id,name:data.name,text,at:now,...(room.mode==='werewolf'?{gameId:room.werewolf.id,channel}:{})};
   room.chat.push(entry);if(room.chat.length>MAX_CHAT_HISTORY)room.chat.splice(0,room.chat.length-MAX_CHAT_HISTORY);
   if(room.mode==='werewolf'){for(const receiver of room.users.keys())if(readWerewolfChat(room,receiver,[entry]).length)events.push({to:receiver,message:{type:'chat',entry,overhead:channel==='day'||channel==='public',revision:room.revision}});}
   else events.push({message:{type:'chat',entry,revision:room.revision}});return {events};
  }
  case 'refresh':return {events,snapshot:snapshot(room,now,id)};
  case 'heartbeat':
   if(expireMembers(room,now))events.push(stateEvent(room,now));
   return {events,snapshot:snapshot(room,now,id)};
  case 'move':{
   if(room.mode==='werewolf')return {events};
   const {x,z,yaw,bodyYaw,pitch,gait}=message;
   if(![x,z,yaw,pitch].every(Number.isFinite))return {events};
   if(bodyYaw!==undefined&&!Number.isFinite(bodyYaw))return {events};
   const target=position(x,z,singer),allowed=data.seat<0&&(singer||clearSeat(target.x,target.z));
   const moved=allowed&&Math.hypot(target.x-data.x,target.z-data.z)>.0001;
   if(allowed)Object.assign(data,target);
   if(moved)data.emoteAt=0;
   if(allowed&&bodyYaw!==undefined)data.bodyYaw=wrapYaw(bodyYaw);
   data.gait=moved&&gaits.has(gait)?gait:'idle';data.movingUntil=moved?now+240:0;
   data.yaw=wrapYaw(yaw);data.pitch=Math.min(1,Math.max(-1,pitch));
   events.push({message:{type:'pose',user:{...data},revision:room.revision}});return {events};
  }
  case 'jump':
   if(data.seat>=0||jumpPose(data.jumpAt,now).state)return {events};
   data.jumpAt=now;data.emoteAt=0;events.push({message:{type:'pose',user:{...data},revision:room.revision}});return {events};
  case 'emote':return {events};
  case 'voice-session':
   if(room.mode==='werewolf'){const voice=werewolfVoice(room,id);return {events,voice:voice?.key===message.key?voice:null};}
   return {events,voice:room.mode==='movie'&&message.key===room.movieVoiceKey?{key:room.movieVoiceKey,group:true}:room.song&&message.key===room.song.key?{key:room.song.key,owner:room.song.owner}:null};
  case 'signal':
   if(room.users.has(message.to)&&(singer||message.to===room.song?.owner))events.push({to:message.to,message:{type:'signal',from:id,signal:message.signal,revision:room.revision}});
   return {events};
  case 'name':data.name=String(message.value||'Khách').trim().slice(0,MAX_NAME)||'Khách';break;
  case 'appearance':
   if(message.animal!==undefined){if(!isAnimal(message.animal))return {events};if(member.animalChosen&&data.animal!==message.animal)return {events:[{to:id,message:{type:'error',message:'Bạn không thể đổi loài khi đã vào phòng.'}}]};data.animal=message.animal;member.animalChosen=true;break;}
   if(message.face!==undefined&&!isFace(message.face)||message.skin!==undefined&&!isSkin(message.skin))return {events};
   if(message.shirt!==undefined&&!isShirt(message.shirt))return {events};
   if(message.face===undefined&&message.skin===undefined&&message.shirt===undefined)return {events};
   if(message.face!==undefined)data.face=message.face;
   if(message.skin!==undefined)data.skin=message.skin;
   if(message.shirt!==undefined)data.shirt=shirtColor(message.shirt);
   break;
  case 'seat':
   if(singer)return {events};
   if(message.index===-1&&data.seat>=0){data.seat=-1;data.z-=.83;}
   else if(Number.isInteger(message.index)&&seats[message.index]&&![...room.users.values()].some(u=>u.data.seat===message.index))Object.assign(data,{seat:message.index,...seats[message.index]});
   else return {events};
   Object.assign(data,resetMotion);
   if(data.seat>=0)Object.assign(data,{bodyYaw:0,yaw:0,pitch:0});break;
  case 'queue':{
   const requestId=typeof message.requestId==='string'&&/^[\w-]{8,64}$/.test(message.requestId)?message.requestId:undefined;
   const reply=(accepted,error,key)=>({events,snapshot:snapshot(room,now,id),queueResult:requestId?{type:'queue-result',requestId,accepted,error,key}:null});
   if(typeof message.video!=='string'||! /^[\w-]{11}$/.test(message.video))return reply(false,'Liên kết video không hợp lệ.');
   member.queueRequests??=[];
   const existing=requestId&&member.queueRequests.find(item=>item.requestId===requestId);
   if(existing)return reply(true,undefined,existing.key);
   if(room.queue.length>=MAX_QUEUE)return reply(false,'Hàng đợi đã đầy. Hãy đăng ký lại sau.');
   const entry={owner:id,video:message.video,title:String(message.title||'Bài hát YouTube').slice(0,MAX_TITLE),key:randomUUID()};
   room.queue.push(entry);
   if(requestId){member.queueRequests.push({requestId,key:entry.key});member.queueRequests=member.queueRequests.slice(-32);}
   if(room.mode!=='movie'&&!room.song)advance(room,now);
   events.push(stateEvent(room,now));return reply(true,undefined,entry.key);
  }
  case 'finish':
   if(!singer||message.key!==room.song.key)return {events};
   advance(room,now);break;
  case 'next':
   if(!singer||message.key!==room.song?.key)return controlReply(false,'Lượt hát đã thay đổi hoặc bạn không phải người đang hát.');
   advance(room,now);events.push(stateEvent(room,now));return controlReply(true);
  case 'playback':{
   if(!singer||message.key!==room.song?.key||typeof message.paused!=='boolean')return controlReply(false,'Không điều khiển được lượt hát hiện tại.');
   const paused=Number.isFinite(room.song.pausedAt);if(paused===message.paused)return controlReply(true);
   if(message.paused){room.song.pausedAt=now;delete room.song.endAt;}
   else{room.song.start=room.song.awaitingStart?now:room.song.start+Math.max(0,now-room.song.pausedAt);delete room.song.pausedAt;delete room.song.awaitingStart;if(room.song.duration)room.song.endAt=room.song.start+room.song.duration*1000;}
   delete room.song.playhead;delete room.song.buffering;
   events.push(stateEvent(room,now));return controlReply(true);
  }
  case 'video-progress':{
   if(!singer||message.key!==room.song.key||message.start!==room.song.start||Number.isFinite(room.song.pausedAt)||!Number.isFinite(message.position)||message.position<0||message.position>21600||![1,2,3].includes(message.state))return {events};
   if(room.song.duration)room.song.endAt=Math.max(room.song.endAt||0,now+Math.max(0,room.song.duration-message.position)*1000+2000);
   return {events,deadline:room.song?{...room.song}:null};
  }
  case 'duration':
   if(!singer||message.key!==room.song.key||message.video!==room.song.video||!Number.isFinite(message.duration)||message.duration<=0||message.duration>21600)return {events};
   if(room.song.duration===message.duration)return {events};
   room.song.duration=message.duration;if(!Number.isFinite(room.song.pausedAt))room.song.endAt=room.song.start+message.duration*1000;break;
  case 'mic':if(room.mode==='werewolf'&&!werewolfVoice(room,id))return {events};if(!singer&&!['movie','werewolf'].includes(room.mode))return {events};data.mic=!!message.on;break;
  case 'leave':removeMember(room,id,now);break;
  default:return {events};
 }
 events.push(stateEvent(room,now));return {events};
}

export function disconnectMember(room,id,connectionId,now,grace=RESUME_GRACE_MS){
 const member=room.users.get(id);
 if(!member||member.connectionId!==connectionId)return {events:[]};
 if(grace===0||member.expiresAt<=now)removeMember(room,id,now);
 else {member.connectionId=null;member.expiresAt=now+grace;member.data.mic=false;Object.assign(member.data,resetMotion);}
 pauseEmptyMovie(room,now);
 return {events:[stateEvent(room,now)]};
}
