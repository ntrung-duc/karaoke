import {buildHall} from './hall.js';
import {roomName} from './session.js';
import {faceIndex,skinIndex,SKINS,shirtColor} from './avatar-settings.js';
import {createFacePicker} from './faces.js';
import {createConnection} from './connection.js';
import {createAudioOutput} from './audio-output.js';
import {createPlaybackMonitor,songElapsed,createVideoSync,createVoiceDelay} from './playback.js';
import {createServerClock} from './server-clock.js';
import {createChat} from './chat.js';
import {createSongSearch} from './youtube-search.js';
import {EMOTES,emoteName} from './emotes.js';
import {createMicTestPanel} from './mic-test-panel.js';
import {createSingerMic} from './singer-mic.js';
const $=s=>document.querySelector(s),room=roomName(new URLSearchParams(location.search).get('room'));
for(const select of [$('#emote-choice'),$('#room-emote-choice')]){for(const emote of EMOTES){const option=document.createElement('option');option.value=emote.id;option.textContent=emote.name;select.append(option);}select.value='wolf';}
function controlIcon(button,label,icon){
 const symbol=document.createElement('span');symbol.className='control-icon';symbol.setAttribute('aria-hidden','true');if(typeof icon==='string')symbol.textContent=icon;else symbol.append(icon);
 const text=document.createElement('span');text.className='control-label';text.textContent=label;button.replaceChildren(symbol,text);button.setAttribute('aria-label',label);button.title=label;
}
function microphoneIcon(on){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');
 const shape=document.createElementNS(ns,'path');shape.setAttribute('d','M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5 M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8');svg.append(shape);
 if(!on){const slash=document.createElementNS(ns,'path');slash.setAttribute('d','M3 3L21 21');slash.setAttribute('stroke','#ff4f63');slash.setAttribute('stroke-width','3');svg.append(slash);}return svg;
}
function emoteControl(user){const active=!!user?.emoteAt&&emoteName(user.emote)===emoteName($('#emote-choice').value);controlIcon($('#emote'),active?'Dừng nhảy':'Emote',active?'■':'💃');$('#emote').setAttribute('aria-pressed',String(active));}
controlIcon($('#singer-test-mic'),'Test mic','🎚');controlIcon($('#next'),'Bỏ qua bài','⏭');controlIcon($('#pause'),'Bắt đầu hát','▶');emoteControl();
let id='',connection,users=[],song=null,stream=null,ice=[],player=null,ready=false,connected=false;
let chosenFace=faceIndex(Number(localStorage.getItem('rap-face')||0));
let chosenSkin=skinIndex(Number(localStorage.getItem('rap-skin')||0));
let chosenShirt=shirtColor(localStorage.getItem('rap-shirt'));
const shirtPicker=$('#shirt-picker');shirtPicker.value=chosenShirt;
shirtPicker.oninput=()=>{chosenShirt=shirtColor(shirtPicker.value);hall?.appearance(undefined,undefined,chosenShirt);};
shirtPicker.onchange=()=>{chosenShirt=shirtColor(shirtPicker.value);localStorage.setItem('rap-shirt',chosenShirt);hall?.appearance(undefined,undefined,chosenShirt);send({type:'appearance',shirt:chosenShirt});};
const skinPicker=$('#skin-picker');
SKINS.forEach((skin,index)=>{const option=document.createElement('option');option.value=index;option.textContent=skin.name;skinPicker.append(option);});
if(localStorage.getItem('rap-skin')===null){const option=document.createElement('option');option.value='';option.textContent='Chọn màu da';option.disabled=true;option.selected=true;skinPicker.prepend(option);}else skinPicker.value=chosenSkin;
skinPicker.onchange=()=>{chosenSkin=skinIndex(Number(skinPicker.value));localStorage.setItem('rap-skin',String(chosenSkin));hall?.appearance(undefined,chosenSkin);send({type:'appearance',skin:chosenSkin});};
const facePicker=createFacePicker($('#face-picker'),face=>{
 chosenFace=face;localStorage.setItem('rap-face',String(face));hall?.appearance(face);send({type:'appearance',face});
});
facePicker.select(chosenFace);
let noticeTimer;
const voiceRetries=new Map(),retiredVoices=new Set(),candidateBacklog=new Map(),voiceRequestAt=new Map();
const peers=new Map(),notice=(text,duration=0)=>{clearTimeout(noticeTimer);$('#notice').textContent=text;if(duration>0)noticeTimer=setTimeout(()=>{if($('#notice').textContent===text)$('#notice').textContent='';},duration);};
let micOpening=false;
const mobileMic=()=>navigator.maxTouchPoints>0&&(matchMedia('(pointer:coarse)').matches||matchMedia('(max-width:800px)').matches);
const micTest=createMicTestPanel({root:$('#mic-test-panel'),toggle:$('#test-mic'),canTest:()=>!stream&&!micOpening});
function updateMicControls(){for(const button of [$('#mic'),$('#singer-mic')]){button.disabled=!connected||song?.owner!==id||micOpening;controlIcon(button,micOpening?'Đang bật mic…':stream?'Tắt mic':'Bật mic',microphoneIcon(!!stream));button.setAttribute('aria-pressed',String(!!stream));}$('#singer-mic').hidden=!mobileMic();}
function readReverb(){try{const saved=localStorage.getItem('rap-reverb'),value=Number(saved);return saved!==null&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):20;}catch{return 20;}}
const singerMic=createSingerMic({reverb:readReverb()/100,getSession:()=>({key:song?.key,allowed:connected&&song?.owner===id,mobile:mobileMic()}),beforeStart:()=>micTest.close(),onState:state=>{stream=state.stream;micOpening=state.pending;updateMicControls();},onLive:()=>{send({type:'mic',on:true});if(!mobileMic())notice('Mic đã bật cho lượt hát của bạn.',3000);},onStop:()=>{for(const entry of peers.values())closePeer(entry);peers.clear();},onLost:()=>{send({type:'mic',on:false});notice('Mic đã ngắt. Bấm Bật mic để kết nối lại.');},onError:()=>notice('Chưa bật được mic. Cho phép micro rồi bấm Bật mic trên thanh điều khiển hoặc trong Phòng hát.')});
const sound=$('#sound');
const output=createAudioOutput({storage:localStorage,getPlayer:()=>ready&&song?player:null,canPlay:()=>!Number.isFinite(song?.pausedAt),getAudio:()=>[...peers.values()].map(e=>e.audio).filter(Boolean),onChange:({muted,label,musicVolume,voiceVolume})=>{for(const [kind,value] of [['music',musicVolume],['voice',voiceVolume]]){$('#'+kind+'-volume').value=value;$('#'+kind+'-volume-value').textContent=value+'%';}sound.querySelector('b').textContent=muted?'🔇':'🔊';sound.querySelector('span').textContent=label;sound.setAttribute('aria-label',label);sound.setAttribute('aria-pressed',String(muted));}});
const serverClock=createServerClock({send});
const videoSync=createVideoSync(),voiceDelay=createVoiceDelay(localStorage);
const delayPicker=$('#voice-delay');delayPicker.value=voiceDelay.value;$('#voice-delay-value').textContent=voiceDelay.value+' ms';
delayPicker.oninput=()=>{$('#voice-delay-value').textContent=delayPicker.value+' ms';};
delayPicker.onchange=()=>{delayPicker.value=voiceDelay.set(delayPicker.value);$('#voice-delay-value').textContent=voiceDelay.value+' ms';sync();};
const reverbPicker=$('#voice-reverb');reverbPicker.value=readReverb();$('#voice-reverb-value').textContent=reverbPicker.value+'%';
reverbPicker.oninput=()=>{$('#voice-reverb-value').textContent=reverbPicker.value+'%';singerMic.setReverb(reverbPicker.value/100);};
reverbPicker.onchange=()=>{try{localStorage.setItem('rap-reverb',reverbPicker.value);}catch{}};
const playback=createPlaybackMonitor(send);
const search=createSongSearch({send,notice});
const chat=createChat({send,getId:()=>id,isOpen:()=>!$('#chat').hidden,notice});
output.apply();
$('#music-volume-help').hidden=!(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
sound.onclick=()=>{output.toggle();notice('');};
for(const kind of ['music','voice'])$('#'+kind+'-volume').oninput=event=>output.setVolume(kind,event.target.value);
function send(m){return connection?.send(m)}
let hall;try{hall=buildHall($('#view'),send,()=>id)}catch(e){notice('Trình duyệt cần bật WebGL để xem nhà hát');console.error(e)}
function stopMic(){singerMic.stop();}
window.addEventListener('pagehide',()=>{stopMic();serverClock.stop();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){serverClock.request();sync();}});
function closePeer(entry){clearTimeout(entry.retryTimer);clearTimeout(entry.requestTimer);if(entry.voiceId)retiredVoices.add(entry.voiceId);while(retiredVoices.size>128)retiredVoices.delete(retiredVoices.values().next().value);if(entry.audio){entry.audio.pause();entry.audio.srcObject=null;entry.audio.remove();}entry.pc.close();}
function requestVoice(other,force=false){
 if(!connected||!song||song.owner===id||!other||!users.some(u=>u.id===other&&u.mic))return false;
 const entry=peers.get(other);if(!force&&entry&&!['failed','closed'].includes(entry.pc.connectionState))return false;
 const now=Date.now();if(now-(voiceRequestAt.get(other)||0)<5000)return false;
 voiceRequestAt.set(other,now);send({type:'signal',to:other,signal:{retry:true,key:song.key}});return true;
}
function recoverPeer(other,entry){
 if(peers.get(other)!==entry||song?.key!==entry.turn)return;
 const attempts=voiceRetries.get(other)||0;if(attempts>=2)return;voiceRetries.set(other,attempts+1);
 if(stream&&song?.owner===id){closePeer(entry);peers.delete(other);offer(other).catch(()=>voiceStatus());return;}
 const wait=Math.max(0,5000-(Date.now()-(voiceRequestAt.get(other)||0)));
 entry.requestTimer=setTimeout(()=>{
  if(peers.get(other)!==entry||song?.owner!==other)return;
  requestVoice(other,true);
  if((voiceRetries.get(other)||0)<2)entry.retryTimer=setTimeout(()=>recoverPeer(other,entry),5000);
 },wait);
}
function voiceStatus(){
 const status=$('#voice-status');$('#voice-retry').hidden=!song||song.owner===id;
 if(!song){status.textContent='Chưa có người hát.';return;}
 if(song.owner===id){
  if(!stream){status.textContent=micOpening?'Đang mở micro…':'Micro phát cho phòng đang tắt.';return;}
  const connectedPeers=[...peers.values()].filter(e=>e.pc.connectionState==='connected').length;
  status.textContent='Micro: '+(stream.getAudioTracks()[0]?.label||'Đã mở')+' · Kết nối tới '+connectedPeers+'/'+users.filter(u=>u.id!==id).length+' người nghe.';
 }else{
  const source=users.find(u=>u.id===song.owner),entry=peers.get(song.owner);
  status.textContent=!source?.mic?'Người hát đang tắt mic.':entry?.pc.connectionState==='connected'?'Đã kết nối giọng hát.':(voiceRetries.get(song.owner)||0)>=2?'Giọng hát bị gián đoạn. Chạm “Kết nối lại giọng hát” để thử lại.':entry?.pc.connectionState==='failed'?'Đang thử kết nối lại giọng hát…':'Đang kết nối giọng hát…';
 }
}
function link(other,voiceId){
 if(peers.has(other))return peers.get(other);
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},...ice]});const entry={pc,pending:[],turn:song?.key,voiceId:voiceId||crypto.randomUUID(),signals:Promise.resolve(),createdAt:Date.now(),recoveryAttempts:0};peers.set(other,entry);
 pc.onconnectionstatechange=()=>{
  voiceStatus();
  if(pc.connectionState==='connected'){voiceRetries.delete(other);entry.recoveryAttempts=0;clearTimeout(entry.retryTimer);clearTimeout(entry.requestTimer);}
  if(pc.connectionState==='failed'||pc.connectionState==='disconnected'){
   clearTimeout(entry.retryTimer);
   entry.retryTimer=setTimeout(()=>recoverPeer(other,entry),pc.connectionState==='failed'?1000:4000);
  }
 };
 pc.onicecandidate=e=>{if(e.candidate)send({type:'signal',to:other,signal:{candidate:e.candidate,key:entry.turn,voiceId:entry.voiceId}})};
 pc.ontrack=e=>{if(entry.audio){entry.audio.srcObject=null;entry.audio.remove();}const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.hidden=true;audio.srcObject=e.streams[0]||new MediaStream([e.track]);entry.audio=audio;document.body.append(audio);output.attach(audio);audio.play().catch(()=>{output.block();if(!output.muted)notice('Mở Phòng hát và bấm Kết nối lại giọng hát để bật tiếng.');});voiceStatus();};return entry;
}
async function offer(other){
 if(!stream||song?.owner!==id||!users.some(u=>u.id===other))return;
 const existing=peers.get(other);if(existing&&!['failed','closed'].includes(existing.pc.connectionState))return;
 if(existing){closePeer(existing);peers.delete(other);}
 const entry=link(other),{pc}=entry,turn=song?.key;
 try{stream.getTracks().forEach(t=>pc.addTrack(t,stream));await pc.setLocalDescription(await pc.createOffer());if(song?.key===turn&&peers.get(other)===entry)send({type:'signal',to:other,signal:{desc:pc.localDescription,key:turn,voiceId:entry.voiceId}});}
 catch(error){if(peers.get(other)===entry){closePeer(entry);peers.delete(other);}throw error;}
}
async function signal(m){
 const s=m.signal;if(!s||s.key&&s.key!==song?.key||(!stream&&m.from!==song?.owner)||!users.some(u=>u.id===m.from))return;
 let e=peers.get(m.from);
 if(s.retry===true){if(stream&&song?.owner===id&&s.key===song.key&&Date.now()-(voiceRequestAt.get(m.from)||0)>=5000){voiceRequestAt.set(m.from,Date.now());if(e&&Date.now()-e.createdAt<6000&&!['failed','closed'].includes(e.pc.connectionState))return;if(e){closePeer(e);peers.delete(m.from);}await offer(m.from);}return;}
 if(s.voiceId&&retiredVoices.has(s.voiceId))return;
 // Candidates from a replacement connection can precede its SDP offer. Keep
 // those separate from the old connection instead of mixing their ICE data.
 if(s.candidate&&s.voiceId&&e?.voiceId!==s.voiceId){
  if(song?.owner===id)return;
  const candidates=candidateBacklog.get(s.voiceId)||[];if(candidates.length<32)candidates.push(s.candidate);
  candidateBacklog.set(s.voiceId,candidates);while(candidateBacklog.size>8)candidateBacklog.delete(candidateBacklog.keys().next().value);return;
 }
 if(s.desc?.type==='offer'){
  if(m.from!==song?.owner)return;
  if(e&&s.voiceId&&e.voiceId!==s.voiceId){closePeer(e);peers.delete(m.from);e=null;}
 }else if(s.desc?.type==='answer'&&(!stream||song?.owner!==id||!e||s.voiceId&&s.voiceId!==e.voiceId))return;
 e=link(m.from,s.voiceId);
 if(s.voiceId&&candidateBacklog.has(s.voiceId)){e.pending.push(...candidateBacklog.get(s.voiceId));candidateBacklog.delete(s.voiceId);}
 const task=e.signals.then(async()=>{
  if(peers.get(m.from)!==e||s.key&&s.key!==song?.key)return;
  if(s.desc){
   await e.pc.setRemoteDescription(s.desc);
   for(const c of e.pending.splice(0))try{await e.pc.addIceCandidate(c);}catch{}
   if(s.desc.type==='offer'&&peers.get(m.from)===e){await e.pc.setLocalDescription(await e.pc.createAnswer());send({type:'signal',to:m.from,signal:{desc:e.pc.localDescription,key:e.turn,voiceId:e.voiceId}});}
  }else if(s.candidate){if(e.pc.remoteDescription)await e.pc.addIceCandidate(s.candidate);else e.pending.push(s.candidate);}
 });
 e.signals=task.catch(()=>{});return task;
}
const elapsed=()=>songElapsed(song,serverClock.now());
function checkPlayback(){if(ready&&song)playback.check({song,id,player,elapsed:elapsed()});}
function sync(){
 if(!ready)return;
 if(videoSync.sync({song,id,player,now:serverClock.now(),delayMs:voiceDelay.value})){output.apply();return;}
 checkPlayback();
}
window.onYouTubeIframeAPIReady=()=>{if(!hall)return;player=new YT.Player('player',{width:'800',height:'450',playerVars:{playsinline:1,controls:0,disablekb:1,origin:location.origin},events:{
 onReady:()=>{ready=true;player.getIframe().tabIndex=-1;output.apply();sync();},
 onStateChange:event=>{if(event.data===1||event.data===5)output.apply();sync();},
 onAutoplayBlocked:()=>{output.block();if(!output.muted)notice('Nhấn Bật âm thanh để bắt đầu nghe.');},
 onError:()=>notice('YouTube không phát được video này. Người hát có thể kết thúc lượt và chọn link khác.')
}})};
const yt=document.createElement('script');yt.src='https://www.youtube.com/iframe_api';yt.onerror=()=>notice('Chưa kết nối được YouTube. Kiểm tra mạng để phát bài hát.');setInterval(()=>{if(song)sync()},1000);
function row(parent,str,dim=false){const el=document.createElement('div');el.className='item'+(dim?' dim':'');el.textContent=str;parent.append(el);return el}
function render(m){
 const old=song;song=m.song;const mine=song?.owner===id;users=m.users;chat.history(m.chat||[]);if(song&&!yt.isConnected)document.head.append(yt);serverClock.observe(m.now);
 const changedTurn=old?.key!==song?.key;if(changedTurn){voiceRetries.clear();candidateBacklog.clear();voiceRequestAt.clear();}const keepMic=stream&&mine&&old?.owner===id;
 if(changedTurn&&keepMic){for(const entry of peers.values())closePeer(entry);peers.clear();}
 else if(changedTurn||stream&&!mine||!mine&&!users.find(u=>u.id===song?.owner)?.mic)stopMic();
 for(const [pid,e] of peers)if(!users.some(u=>u.id===pid)){closePeer(e);peers.delete(pid)}
 hall?.users(users,song?.owner,m.now);hall?.flowerTurn(song?.key??null);hall?.media(!!song);const me=users.find(u=>u.id===id);
 facePicker.select(me?.face??chosenFace);
 skinPicker.value=skinIndex(me?.skin??chosenSkin);
 emoteControl(me);$('#emote').setAttribute('aria-pressed',String(!!me?.emoteAt));$('#emote').disabled=!connected;$('#singer-controls').hidden=!mine;$('#listener-voice-volume').hidden=mine;$('#singer-reverb').hidden=!mine;$('#throw-flower').hidden=!song||mine;$('#throw-flower').disabled=!connected;controlIcon($('#pause'),song?.awaitingStart?'Bắt đầu hát':Number.isFinite(song?.pausedAt)?'Tiếp tục':'Tạm dừng',Number.isFinite(song?.pausedAt)?'▶':'⏸');$('#singer-test-mic').hidden=!song?.awaitingStart;$('#emote').disabled=$('#pause').disabled=$('#next').disabled=!connected;updateMicControls();$('#sit').disabled=mine;$('#sit').hidden=me?.seat<0||!me;$('#sit').textContent='Đứng dậy';$('#total').textContent=users.length;$('#count').textContent=m.queue.length;$('#people').replaceChildren();$('#songs').replaceChildren();
 for(const u of users)row($('#people'),(u.mic?'🎙 ':'●　')+u.name+(u.id===id?' (bạn)':'')+(u.id===song?.owner?' · Trên sân khấu':u.seat>=0?' · Ghế '+(u.seat+1):' · Đang đứng'));
 const ownerName=s=>users.find(u=>u.id===s.owner)?.name||'Khách';
 if(song)row($('#songs'),'♫　'+song.title+' · '+ownerName(song));else row($('#songs'),'Sân khấu đang trống.',true);
 m.queue.forEach((s,i)=>row($('#songs'),(i+1)+'. '+s.title+' · '+ownerName(s),true));
 if(stream&&mine&&me?.mic)users.filter(u=>u.id!==id).forEach(u=>offer(u.id).catch(()=>notice('Chưa kết nối được mic tới một người nghe.')));
 else if(song&&!mine&&users.find(u=>u.id===song.owner)?.mic&&!peers.has(song.owner))requestVoice(song.owner);
 if(old?.key!==song?.key||old?.pausedAt!==song?.pausedAt){notice('');sync()}
 singerMic.auto();voiceStatus();
}
function connect(){
 if(!room){$('#status').textContent='Tên phòng không hợp lệ';notice('Tên phòng dùng 1–48 chữ Latin, số, gạch ngang hoặc gạch dưới.');return;}
 connection=createConnection({room,
  onHello(m){id=m.id;ice=m.ice;connected=true;hall?.reconnect();send({type:'name',value:$('#name').value});send({type:'appearance',face:chosenFace,skin:chosenSkin,shirt:chosenShirt});if(stream)send({type:'mic',on:true});},
  onMessage(m){if(m.type==='clock'){if(serverClock.receive(m))sync();}else if(m.type==='search-results')search.receive(m);else if(m.type==='state')render(m);else if(m.type==='chat')chat.receive(m.entry);else if(m.type==='flower')hall?.flower(m);else if(m.type==='pose'){hall?.peer(m.user);if(m.user.id===id){const user=users.find(u=>u.id===id);if(user){user.emoteAt=m.user.emoteAt;user.emote=m.user.emote;}emoteControl(m.user);$('#emote').setAttribute('aria-pressed',String(!!m.user.emoteAt));}}else if(m.type==='signal')signal(m).catch(()=>notice('Kết nối giọng hát bị gián đoạn.'));},
  onStatus(status){
   chat.connected(status==='connected');$('#throw-flower').disabled=status!=='connected';
   if(status==='connected'){serverClock.start();$('#status').textContent='●　Trực tuyến';$('#emote').disabled=$('#pause').disabled=$('#next').disabled=false;updateMicControls();return;}
   serverClock.stop();search.disconnected();connected=false;updateMicControls();$('#emote').disabled=$('#pause').disabled=$('#next').disabled=true;
   // Keep capture and song time across Function rotation. Rebuild peers only
   // after the room acknowledges mic, so listeners see the state before offers.
   if(stream){for(const entry of peers.values())closePeer(entry);peers.clear();}
   $('#status').textContent=status==='connecting'?'Đang kết nối':'Đang kết nối lại';
  },onError:notice,
 });connection.connect();
}
$('#name').value=localStorage.getItem('rap-name')||'';$('#name').onchange=()=>{localStorage.setItem('rap-name',$('#name').value);send({type:'name',value:$('#name').value})};
$('#form').onsubmit=e=>{e.preventDefault();if(!connected)return notice('Đang chờ kết nối phòng.');let v;try{const u=new URL($('#url').value.trim());if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))v=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)?.[1];else if(u.hostname==='youtu.be')v=u.pathname.slice(1)}catch{}if(!/^[\w-]{11}$/.test(v||''))return notice('Hãy dán liên kết đến một video YouTube.');send({type:'queue',video:v,title:$('#title').value.trim()||'Karaoke · '+v});e.target.reset();notice('Đã đăng ký bài hát.')};
$('#emote').onclick=async()=>{const key=song?.key;if(song?.owner!==id||!connected)return;const emote=emoteName($('#emote-choice').value),current=users.find(u=>u.id===id),on=!current?.emoteAt||emoteName(current.emote)!==emote;$('#emote').disabled=$('#emote-choice').disabled=$('#room-emote-choice').disabled=true;try{if(on&&!await hall?.prepareEmote(emote))return;if(song?.key!==key||!connected)return;hall?.emote(on,emote);if(current){current.emoteAt=on?Date.now():0;current.emote=emote;}send({type:'emote',key,on,emote});}catch{notice('Chưa tải được điệu nhảy. Bấm lại để thử.');}finally{$('#emote').disabled=$('#emote-choice').disabled=$('#room-emote-choice').disabled=!connected;}};
$('#emote-choice').onchange=()=>{$('#room-emote-choice').value=$('#emote-choice').value;emoteControl(users.find(u=>u.id===id));};
$('#room-emote-choice').onchange=()=>{$('#emote-choice').value=$('#room-emote-choice').value;$('#emote-choice').onchange();};
$('#pause').onclick=()=>{
 if(song?.owner!==id)return;
 const paused=Number.isFinite(song.pausedAt);
 if(paused){
  micTest.close();
  // Start the iframe directly inside the singer's click. Waiting for the
  // server state round trip loses the browser's user-activation permission.
  if(ready&&player){player.seekTo(song.awaitingStart?0:elapsed(),true);player.playVideo();}
 }else player?.pauseVideo();
 send({type:'playback',key:song.key,paused:!paused});
};
$('#singer-test-mic').onclick=()=>{showPanel('room');if($('#mic-test-panel').hidden)$('#test-mic').click();};
$('#camera').onclick=()=>hall?.camera();$('#sit').onclick=()=>hall?.seat();$('#next').onclick=()=>song&&send({type:'next',key:song.key});
$('#mic').onclick=()=>{if(stream){stopMic();send({type:'mic',on:false});}else singerMic.start();};
$('#singer-mic').onclick=()=>$('#mic').click();
$('#voice-retry').onclick=()=>{output.enable();if(song?.owner!==id&&song){voiceRetries.delete(song.owner);requestVoice(song.owner,true);}};

let flowerAt=-Infinity;
$('#throw-flower').onclick=()=>{if(!connected||!song||song.owner===id||performance.now()-flowerAt<1200)return;if(send({type:'flower',key:song.key})){flowerAt=performance.now();hall?.focus();}};

$('#invite').onclick=async()=>{const u=new URL(location.href);u.searchParams.set('room',room);if(['localhost','127.0.0.1'].includes(u.hostname)){notice('Để mời bạn bè, mở phòng qua địa chỉ HTTPS dùng chung rồi sao chép liên kết.');return}try{await navigator.clipboard.writeText(u.href);notice('Đã sao chép liên kết phòng.')}catch{notice(u.href)}};

const drawer=$('#drawer');
const switches=document.querySelectorAll('[data-panel]');
let selectedPanel=null;
function showPanel(name){
 if(name!=='room')micTest.close();
 const previous=selectedPanel;
 selectedPanel=name;
 drawer.hidden=!name;
 if(name==='chat')chat.open();
 for(const control of switches){
  const selected=control.dataset.panel===name;
  control.setAttribute('aria-expanded',String(selected));
  $('#'+control.dataset.panel).hidden=!selected;
  if(selected)$('#panel-title').textContent={music:'Chọn bài',room:'Phòng hát',chat:'Chat'}[name];
 }
 if(name)$('#close').focus();
 else if(previous)hall?.focus();
}
switches.forEach(button=>button.onclick=()=>showPanel(selectedPanel===button.dataset.panel?null:button.dataset.panel));
$('#close').onclick=()=>showPanel(null);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selectedPanel)showPanel(null)});

const fullscreen=document.createElement('button');
fullscreen.textContent='Toàn màn hình';
if(document.fullscreenEnabled){
 $('#camera').after(fullscreen);
 fullscreen.onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();showPanel(null)}
  catch{notice('Trình duyệt chưa cho phép bật toàn màn hình.')}
 };
 document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'Thoát toàn màn hình':'Toàn màn hình'});
}

const welcome=document.querySelector('#welcome-dialog'),profileForm=document.querySelector('#profile-form');
welcome.addEventListener('cancel',event=>event.preventDefault());
profileForm.onsubmit=event=>{
 event.preventDefault();const name=$('#name').value.trim();
 $('#name').setCustomValidity(name?'':'Hãy nhập tên của bạn.');
 if(!profileForm.reportValidity())return;
 $('#name').value=name;chosenSkin=skinIndex(Number(skinPicker.value));chosenShirt=shirtColor(shirtPicker.value);
 localStorage.setItem('rap-name',name);localStorage.setItem('rap-skin',String(chosenSkin));localStorage.setItem('rap-shirt',chosenShirt);
 output.enable({restoreSilentLevels:true});welcome.close();connect();hall?.focus();
};
$('#name').addEventListener('input',()=>$('#name').setCustomValidity(''));
welcome.showModal();
