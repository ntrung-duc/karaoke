import {createHash,randomUUID} from 'node:crypto';
import {seats,position,clearSeat} from '../public/layout.js';
import {gaits,jumpPose} from '../public/motion.js';
import {MAX_QUEUE,MAX_NAME,MAX_TITLE} from '../public/session.js';
import {isFace,isSkin,wrapYaw,isShirt,shirtColor} from '../public/avatar-settings.js';

export const PRESENCE_MS=60000;
export const RESUME_GRACE_MS=45000;
const resetMotion={gait:'idle',movingUntil:0,jumpAt:0};
export const tokenDigest=token=>createHash('sha256').update(token).digest('hex');
export const emptyRoom=()=>({users:new Map(),queue:[],song:null,revision:0});
export const encodeRoom=room=>JSON.stringify({...room,users:[...room.users]});
export const decodeRoom=raw=>raw?({...JSON.parse(raw),users:new Map(JSON.parse(raw).users)}):emptyRoom();
export const snapshot=(room,now)=>({type:'state',users:[...room.users.values()].map(u=>({...u.data})),queue:room.queue.map(s=>({...s})),song:room.song?{...room.song}:null,now,revision:room.revision});
export const stateEvent=(room,now)=>({message:snapshot(room,now)});

function advance(room,now){
 const previous=room.users.get(room.song?.owner)?.data;
 if(previous)Object.assign(previous,{x:-5.9,z:-.95,seat:-1,mic:false,yaw:0,bodyYaw:0,pitch:0,...resetMotion});
 room.song=room.queue.shift()||null;
 if(room.song){
  room.song.start=now+1200;
  Object.assign(room.users.get(room.song.owner).data,{x:0,z:-4,seat:-1,yaw:Math.PI,bodyYaw:Math.PI,pitch:0,...resetMotion});
 }
}
export function removeMember(room,id,now){
 room.users.delete(id);room.queue=room.queue.filter(song=>song.owner!==id);
 if(room.song?.owner===id)advance(room,now);
}
export function expireMembers(room,now){
 const expired=[...room.users].filter(([,u])=>u.expiresAt<=now).map(([id])=>id);
 for(const id of expired)removeMember(room,id,now);
 return expired.length>0;
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
  const seat=seats.findIndex((_,index)=>![...room.users.values()].some(u=>u.data.seat===index));
  const data={id,name:'Khách',seat,...(seats[seat]||{x:0,z:11}),yaw:0,bodyYaw:0,pitch:0,face:0,skin:0,shirt:shirtColor(),color:Math.floor(Math.random()*6),mic:false,...resetMotion};
  member={data,tokenDigest:tokenDigest(token)};room.users.set(id,member);
 }else token=resumeToken;
 member.connectionId=connectionId;member.expiresAt=now+PRESENCE_MS;
 return {id:member.data.id,token,events:[{takeover:{id:member.data.id,connectionId}},stateEvent(room,now)]};
}

// Pure state changes run again when Redis detects a concurrent writer. Socket
// sends and other external effects happen only after a successful commit.
export function applyMessage(room,id,connectionId,message,now){
 const events=[],member=room.users.get(id);
 if(!member||member.connectionId!==connectionId||member.expiresAt<=now)return {expired:true,events};
 member.expiresAt=now+PRESENCE_MS;
 const data=member.data,singer=room.song?.owner===id;
 switch(message.type){
  case 'heartbeat':
   if(expireMembers(room,now))events.push(stateEvent(room,now));
   return {events,snapshot:snapshot(room,now)};
  case 'move':{
   const {x,z,yaw,bodyYaw,pitch,gait}=message;
   if(![x,z,yaw,pitch].every(Number.isFinite))return {events};
   if(bodyYaw!==undefined&&!Number.isFinite(bodyYaw))return {events};
   const target=position(x,z,singer),allowed=data.seat<0&&(singer||clearSeat(target.x,target.z));
   const moved=allowed&&Math.hypot(target.x-data.x,target.z-data.z)>.0001;
   if(allowed)Object.assign(data,target);
   if(allowed&&bodyYaw!==undefined)data.bodyYaw=wrapYaw(bodyYaw);
   data.gait=moved&&gaits.has(gait)?gait:'idle';data.movingUntil=moved?now+240:0;
   data.yaw=wrapYaw(yaw);data.pitch=Math.min(1,Math.max(-1,pitch));
   events.push({message:{type:'pose',user:{...data},revision:room.revision}});return {events};
  }
  case 'jump':
   if(data.seat>=0||jumpPose(data.jumpAt,now).state)return {events};
   data.jumpAt=now;events.push({message:{type:'pose',user:{...data},revision:room.revision}});return {events};
  case 'signal':
   if(room.users.has(message.to)&&(singer||message.to===room.song?.owner))events.push({to:message.to,message:{type:'signal',from:id,signal:message.signal,revision:room.revision}});
   return {events};
  case 'name':data.name=String(message.value||'Khách').trim().slice(0,MAX_NAME)||'Khách';break;
  case 'appearance':
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
  case 'queue':
   if(typeof message.video!=='string'||! /^[\w-]{11}$/.test(message.video)||room.queue.length>=MAX_QUEUE)return {events};
   room.queue.push({owner:id,video:message.video,title:String(message.title||'Bài hát YouTube').slice(0,MAX_TITLE),key:randomUUID()});
   if(!room.song)advance(room,now);break;
  case 'next':
   if(!singer||message.key!==room.song.key)return {events};
   advance(room,now);break;
  case 'playback':{
   if(!singer||message.key!==room.song.key||typeof message.paused!=='boolean')return {events};
   const paused=Number.isFinite(room.song.pausedAt);if(paused===message.paused)return {events};
   if(message.paused){room.song.pausedAt=now;delete room.song.endAt;}
   else{room.song.start+=Math.max(0,now-room.song.pausedAt);delete room.song.pausedAt;if(room.song.duration)room.song.endAt=room.song.start+room.song.duration*1000;}
   break;
  }
  case 'duration':
   if(!singer||message.key!==room.song.key||message.video!==room.song.video||!Number.isFinite(message.duration)||message.duration<=0||message.duration>21600)return {events};
   if(room.song.duration===message.duration)return {events};
   room.song.duration=message.duration;if(!Number.isFinite(room.song.pausedAt))room.song.endAt=room.song.start+message.duration*1000;break;
  case 'mic':if(!singer)return {events};data.mic=!!message.on;break;
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
 return {events:[stateEvent(room,now)]};
}
