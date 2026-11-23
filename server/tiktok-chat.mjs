import {randomUUID} from 'node:crypto';

export function tiktokUsername(value){
 if(typeof value!=='string'||value.length>200)return null;
 let name=value.trim();
 if(/^https?:\/\//i.test(name)){
  try{const url=new URL(name);if(url.protocol!=='https:'||!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(url.hostname)||url.port||url.username||url.password)return null;name=url.pathname.match(/^\/@([\w.]+)(?:\/live)?\/?$/)?.[1]||'';}catch{return null;}
 }
 name=name.replace(/^@/,'');return /^[A-Za-z0-9_][A-Za-z0-9_.]{0,23}$/.test(name)?name.toLowerCase():null;
}

async function defaultConnector(username,signApiKey){
 const {TikTokLiveConnection,WebcastEvent,ControlEvent}=await import('tiktok-live-connector');
 return {client:new TikTokLiveConnection(username,{processInitialData:false,fetchRoomInfoOnConnect:true,webClientOptions:{timeout:{request:10000},retry:{limit:0}},...(signApiKey?{signApiKey}:{})}),chat:WebcastEvent.CHAT,end:WebcastEvent.STREAM_END,disconnected:ControlEvent.DISCONNECTED,error:ControlEvent.ERROR};
}

// Ephemeral, one upstream per occupied room on the single Render server.
// Never put network requests or each TikTok comment in the room transaction queue.
export function createTikTokChat({emit,connector=defaultConnector,signApiKey,now=Date.now,timeoutMs=20000,retryMs=5000,batchMs=250,maxRooms=10}={}){
 const rooms=new Map();
 const idle=()=>({username:'',state:'disconnected',message:'Chưa kết nối TikTok LIVE.'});
 function status(r){return {username:r.username,state:r.state,message:r.message};}
 function publish(r,state,message){r.state=state;r.message=message;emit(r.key,{type:'tiktok-status',...status(r)});}
 function current(r){return rooms.get(r.key)===r&&!r.stopped;}
 function cleanup(r){
  clearTimeout(r.deadline);clearTimeout(r.retry);clearTimeout(r.flush);r.pending=[];
  const client=r.client;r.client=null;
  if(client){client.removeAllListeners();client.on('error',()=>{});try{Promise.resolve(client.disconnect()).catch(()=>{});}catch{}}
 }
 function stop(key,announce=true){const r=rooms.get(key);if(!r)return;rooms.delete(key);r.stopped=true;cleanup(r);if(announce)emit(key,{type:'tiktok-status',...idle()});}
 function failure(r){
  if(!current(r))return;cleanup(r);
  if(r.attempts>=3){publish(r,'error','Chưa kết nối được TikTok. Kiểm tra kênh đang LIVE rồi bấm kết nối lại. TikTok có thể đang chặn kết nối từ máy chủ.');return;}
  publish(r,'reconnecting','Mất kết nối TikTok, đang thử lại ('+r.attempts+'/3)…');
  r.retry=setTimeout(()=>{void connect(r);},retryMs*r.attempts);r.retry.unref?.();
 }
 function comment(r,data){
  if(!current(r)||r.state!=='connected'||typeof data?.comment!=='string')return;
  const text=data.comment.trim().slice(0,400);if(!text)return;
  const msgId=String(data.msgId||data.common?.msgId||'').slice(0,100);
  if(msgId&&r.seen.has(msgId))return;if(msgId)r.seen.add(msgId);
  if(r.seen.size>500)r.seen.delete(r.seen.values().next().value);
  // Five comments/second per room, capped before broadcasting/rendering.
  const second=Math.floor(now()/1000);if(r.second!==second){r.second=second;r.count=0;}if(r.count++>=5)return;
  const user=data.user||data;
  r.pending.push({id:randomUUID(),source:'tiktok',name:String(user.nickname||user.uniqueId||'Khán giả TikTok').slice(0,80),text,at:now()});
  if(!r.flush){r.flush=setTimeout(()=>{r.flush=null;if(current(r)&&r.pending.length)emit(r.key,{type:'tiktok-chat',entries:r.pending.splice(0)});},batchMs);r.flush.unref?.();}
 }
 async function connect(r){
  if(!current(r))return;r.attempts++;publish(r,'connecting','Đang kết nối @'+r.username+'…');
  // Includes module loading and the entire upstream handshake.
  r.deadline=setTimeout(()=>failure(r),timeoutMs);r.deadline.unref?.();
  const attempt=r.attempts;
  const active=()=>current(r)&&r.attempts===attempt&&['connecting','connected'].includes(r.state);
  try{
   const adapter=await connector(r.username,signApiKey),client=adapter.client;
   if(!active()){client.on('error',()=>{});await client.disconnect();return;}
   r.client=client;
   client.on(adapter.error||'error',()=>{if(active())failure(r);});
   client.on(adapter.disconnected||'disconnected',()=>{if(active())failure(r);});
   client.on(adapter.end||'streamEnd',()=>{if(!active())return;cleanup(r);publish(r,'ended','TikTok LIVE đã kết thúc.');});
   client.on(adapter.chat||'chat',data=>{if(active())comment(r,data);});
   await client.connect();
   if(!active()||r.client!==client){try{await client.disconnect();}catch{}return;}
   clearTimeout(r.deadline);publish(r,'connected','Đang nhận chat từ @'+r.username+'.');
  }catch{if(active())failure(r);}
 }
 return {
  status(key){return rooms.has(key)?status(rooms.get(key)):idle();},
  start(key,value){
   const username=tiktokUsername(value);if(!username)return {error:'Nhập @tên_kênh hoặc link https://www.tiktok.com/@tên_kênh/live.'};
   const old=rooms.get(key);if(old?.username===username&&['connecting','connected','reconnecting'].includes(old.state))return {};
   if(!old&&rooms.size>=maxRooms)return {error:'Máy chủ đã đạt giới hạn kết nối TikTok. Thử lại sau.'};
   stop(key,false);const r={key,username,attempts:0,seen:new Set(),pending:[],stopped:false};rooms.set(key,r);void connect(r);return {};
  },
  stop,
  close(){for(const key of rooms.keys())stop(key,false);},
 };
}
