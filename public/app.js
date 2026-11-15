import {buildHall} from './hall.js';
import {roomName} from './session.js';
import {faceIndex,skinIndex,SKINS,shirtColor} from './avatar-settings.js';
import {createFacePicker} from './faces.js';
import {createConnection} from './connection.js';
import {createAudioOutput} from './audio-output.js';
import {createPlaybackMonitor,songElapsed} from './playback.js';
import {createChat} from './chat.js';
import {createSongSearch} from './youtube-search.js';
import {EMOTES,emoteName} from './emotes.js';
const $=s=>document.querySelector(s),room=roomName(new URLSearchParams(location.search).get('room'));
for(const emote of EMOTES){const option=document.createElement('option');option.value=emote.id;option.textContent=emote.name;$('#emote-choice').append(option);}$('#emote-choice').value='wolf';
let id='',connection,users=[],song=null,stream=null,ice=[],player=null,ready=false,offset=0,lastSong='',connected=false;
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
const peers=new Map(),notice=t=>$('#notice').textContent=t;
const sound=$('#sound');
const output=createAudioOutput({storage:localStorage,getPlayer:()=>ready&&song?player:null,canPlay:()=>!Number.isFinite(song?.pausedAt),getAudio:()=>[...peers.values()].map(e=>e.audio).filter(Boolean),onChange:({muted,label})=>{sound.querySelector('b').textContent=muted?'🔇':'🔊';sound.querySelector('span').textContent=label;sound.setAttribute('aria-label',label);sound.setAttribute('aria-pressed',String(muted));}});
let lastPaused=false;
const playback=createPlaybackMonitor(send);
const search=createSongSearch({send,notice});
const chat=createChat({send,getId:()=>id,isOpen:()=>!$('#chat').hidden,notice});
output.apply();
sound.onclick=()=>{output.toggle();notice('');};
function send(m){return connection?.send(m)}
let hall;try{hall=buildHall($('#view'),send,()=>id)}catch(e){notice('Trình duyệt cần bật WebGL để xem nhà hát');console.error(e)}
function stopMic(){stream?.getTracks().forEach(t=>t.stop());stream=null;for(const entry of peers.values())entry.pc.close();peers.clear()}
function link(other){
 if(peers.has(other))return peers.get(other);
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},...ice]});const entry={pc,pending:[]};peers.set(other,entry);
 pc.onicecandidate=e=>{if(e.candidate)send({type:'signal',to:other,signal:{candidate:e.candidate}})};
 pc.ontrack=e=>{const audio=document.createElement('audio');audio.autoplay=true;audio.srcObject=e.streams[0];entry.audio=audio;output.attach(audio);audio.play().catch(()=>{output.block();if(!output.muted)notice('Chạm Bật âm thanh để nghe người hát.');})};return entry;
}
async function offer(other){if(peers.has(other)||!stream)return;const {pc}=link(other);stream.getTracks().forEach(t=>pc.addTrack(t,stream));await pc.setLocalDescription(await pc.createOffer());send({type:'signal',to:other,signal:{desc:pc.localDescription}})}
async function signal(m){const s=m.signal;if(!s||(!stream&&m.from!==song?.owner))return;
 const e=link(m.from);if(s.desc){await e.pc.setRemoteDescription(s.desc);for(const c of e.pending.splice(0))await e.pc.addIceCandidate(c);if(s.desc.type==='offer'){await e.pc.setLocalDescription(await e.pc.createAnswer());send({type:'signal',to:m.from,signal:{desc:e.pc.localDescription}})}}else if(s.candidate){if(e.pc.remoteDescription)await e.pc.addIceCandidate(s.candidate);else e.pending.push(s.candidate)}}
const elapsed=()=>songElapsed(song,Date.now()+offset);
function checkPlayback(){if(ready&&song)playback.check({song,id,player,elapsed:elapsed()});}
function sync(){
 if(!ready)return;
 if(!song){player.stopVideo();lastSong='';lastPaused=false;return;}
 const paused=Number.isFinite(song.pausedAt),resumed=lastPaused&&!paused;lastPaused=paused;
 if(lastSong!==song.key){lastSong=song.key;const video={videoId:song.video,startSeconds:elapsed()};if(paused)player.cueVideoById(video);else player.loadVideoById(video);output.apply();return;}
 checkPlayback();
 if(paused){if(Math.abs(player.getCurrentTime()-elapsed())>.35)player.seekTo(elapsed(),true);if(![2,5].includes(player.getPlayerState()))player.pauseVideo();return;}
 if(resumed){player.seekTo(elapsed(),true);player.playVideo();return;}
 if(player.getPlayerState()===1&&Math.abs(player.getCurrentTime()-elapsed())>2)player.seekTo(elapsed(),true);
}
window.onYouTubeIframeAPIReady=()=>{if(!hall)return;player=new YT.Player('player',{width:'800',height:'450',playerVars:{playsinline:1,controls:0,disablekb:1,origin:location.origin},events:{
 onReady:()=>{ready=true;player.getIframe().tabIndex=-1;output.apply();sync();},
 onStateChange:()=>{if(Number.isFinite(song?.pausedAt)&&player.getPlayerState()===1)player.pauseVideo();checkPlayback();},
 onAutoplayBlocked:()=>{output.block();if(!output.muted)notice('Nhấn Bật âm thanh để bắt đầu nghe.');},
 onError:()=>notice('YouTube không phát được video này. Người hát có thể kết thúc lượt và chọn link khác.')
}})};
const yt=document.createElement('script');yt.src='https://www.youtube.com/iframe_api';yt.onerror=()=>notice('Chưa kết nối được YouTube. Kiểm tra mạng để phát bài hát.');setInterval(()=>{if(song)sync()},1000);
function row(parent,str,dim=false){const el=document.createElement('div');el.className='item'+(dim?' dim':'');el.textContent=str;parent.append(el);return el}
function render(m){
 const old=song;song=m.song;users=m.users;chat.history(m.chat||[]);if(song&&!yt.isConnected)document.head.append(yt);offset=m.now-Date.now();
 if(old?.key!==song?.key||stream&&song?.owner!==id||(!users.find(u=>u.id===song?.owner)?.mic&&!stream))stopMic();
 for(const [pid,e] of peers)if(!users.some(u=>u.id===pid)){e.pc.close();peers.delete(pid)}
 hall?.users(users,song?.owner,m.now);hall?.media(!!song);const mine=song?.owner===id,me=users.find(u=>u.id===id);
 facePicker.select(me?.face??chosenFace);
 skinPicker.value=skinIndex(me?.skin??chosenSkin);
 $('#emote').textContent=me?.emoteAt&&emoteName(me.emote)===emoteName($('#emote-choice').value)?'■ Dừng nhảy':'💃 Emote';$('#emote').setAttribute('aria-pressed',String(!!me?.emoteAt));$('#emote').disabled=!connected;$('#singer-controls').hidden=!mine;$('#pause').textContent=Number.isFinite(song?.pausedAt)?'▶ Tiếp tục':'⏸ Tạm dừng';$('#emote').disabled=$('#pause').disabled=$('#next').disabled=!connected;$('#mic').disabled=!mine;$('#mic').textContent=stream?'Tắt mic':'Bật mic';$('#sit').disabled=mine;$('#sit').hidden=me?.seat<0||!me;$('#sit').textContent='Đứng dậy';$('#total').textContent=users.length;$('#count').textContent=m.queue.length;$('#people').replaceChildren();$('#songs').replaceChildren();
 for(const u of users)row($('#people'),(u.mic?'🎙 ':'●　')+u.name+(u.id===id?' (bạn)':'')+(u.id===song?.owner?' · Trên sân khấu':u.seat>=0?' · Ghế '+(u.seat+1):' · Đang đứng'));
 const ownerName=s=>users.find(u=>u.id===s.owner)?.name||'Khách';
 if(song)row($('#songs'),'♫　'+song.title+' · '+ownerName(song));else row($('#songs'),'Sân khấu đang trống.',true);
 m.queue.forEach((s,i)=>row($('#songs'),(i+1)+'. '+s.title+' · '+ownerName(s),true));
 if(stream&&mine&&me?.mic)users.filter(u=>u.id!==id).forEach(u=>offer(u.id).catch(()=>notice('Chưa kết nối được mic tới một người nghe.')));
 if(old?.key!==song?.key||old?.pausedAt!==song?.pausedAt){notice('');sync()}
}
function connect(){
 if(!room){$('#status').textContent='Tên phòng không hợp lệ';notice('Tên phòng dùng 1–48 chữ Latin, số, gạch ngang hoặc gạch dưới.');return;}
 connection=createConnection({room,
  onHello(m){id=m.id;ice=m.ice;connected=true;hall?.reconnect();send({type:'name',value:$('#name').value});send({type:'appearance',face:chosenFace,skin:chosenSkin,shirt:chosenShirt});if(stream)send({type:'mic',on:true});},
  onMessage(m){if(m.type==='search-results')search.receive(m);else if(m.type==='state')render(m);else if(m.type==='chat')chat.receive(m.entry);else if(m.type==='pose'){hall?.peer(m.user);if(m.user.id===id){const user=users.find(u=>u.id===id);if(user){user.emoteAt=m.user.emoteAt;user.emote=m.user.emote;}$('#emote').textContent=m.user.emoteAt&&emoteName(m.user.emote)===emoteName($('#emote-choice').value)?'■ Dừng nhảy':'💃 Emote';$('#emote').setAttribute('aria-pressed',String(!!m.user.emoteAt));}}else if(m.type==='signal')signal(m).catch(()=>notice('Kết nối giọng hát bị gián đoạn.'));},
  onStatus(status){
   chat.connected(status==='connected');
   if(status==='connected'){$('#status').textContent='●　Trực tuyến';$('#emote').disabled=$('#pause').disabled=$('#next').disabled=false;return;}
   search.disconnected();connected=false;$('#emote').disabled=$('#pause').disabled=$('#next').disabled=true;
   // Keep capture and song time across Function rotation. Rebuild peers only
   // after the room acknowledges mic, so listeners see the state before offers.
   if(stream){for(const entry of peers.values())entry.pc.close();peers.clear();}
   $('#status').textContent=status==='connecting'?'Đang kết nối':'Đang kết nối lại';
  },onError:notice,
 });connection.connect();
}
$('#name').value=localStorage.getItem('rap-name')||'';$('#name').onchange=()=>{localStorage.setItem('rap-name',$('#name').value);send({type:'name',value:$('#name').value})};
$('#form').onsubmit=e=>{e.preventDefault();if(!connected)return notice('Đang chờ kết nối phòng.');let v;try{const u=new URL($('#url').value.trim());if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))v=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)?.[1];else if(u.hostname==='youtu.be')v=u.pathname.slice(1)}catch{}if(!/^[\w-]{11}$/.test(v||''))return notice('Hãy dán liên kết đến một video YouTube.');send({type:'queue',video:v,title:$('#title').value.trim()||'Karaoke · '+v});e.target.reset();notice('Đã đăng ký bài hát.')};
$('#emote').onclick=async()=>{const key=song?.key;if(song?.owner!==id||!connected)return;const emote=emoteName($('#emote-choice').value),current=users.find(u=>u.id===id),on=!current?.emoteAt||emoteName(current.emote)!==emote;$('#emote').disabled=$('#emote-choice').disabled=true;try{if(on&&!await hall?.prepareEmote(emote))return;if(song?.key!==key||!connected)return;hall?.emote(on,emote);if(current){current.emoteAt=on?Date.now():0;current.emote=emote;}send({type:'emote',key,on,emote});}catch{notice('Chưa tải được điệu nhảy. Bấm lại để thử.');}finally{$('#emote').disabled=$('#emote-choice').disabled=!connected;}};
$('#emote-choice').onchange=()=>{const current=users.find(u=>u.id===id);$('#emote').textContent=current?.emoteAt&&emoteName(current.emote)===emoteName($('#emote-choice').value)?'■ Dừng nhảy':'💃 Emote';};
$('#pause').onclick=()=>{if(song?.owner===id)send({type:'playback',key:song.key,paused:!Number.isFinite(song.pausedAt)});};
$('#camera').onclick=()=>hall?.camera();$('#sit').onclick=()=>hall?.seat();$('#next').onclick=()=>song&&send({type:'next',key:song.key});
$('#mic').onclick=async()=>{if(stream){stopMic();send({type:'mic',on:false});return}const current=song?.key;
 try{if(!navigator.mediaDevices)return notice('Mic cần HTTPS hoặc localhost.');const audio=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});if(song?.key!==current||!connected){audio.getTracks().forEach(t=>t.stop());return}stream=audio;send({type:'mic',on:true})}catch{notice('Chưa mở được mic. Kiểm tra quyền mic của trình duyệt.')}};

$('#invite').onclick=async()=>{const u=new URL(location.href);u.searchParams.set('room',room);if(['localhost','127.0.0.1'].includes(u.hostname)){notice('Để mời bạn bè, mở phòng qua địa chỉ HTTPS dùng chung rồi sao chép liên kết.');return}try{await navigator.clipboard.writeText(u.href);notice('Đã sao chép liên kết phòng.')}catch{notice(u.href)}};

const drawer=$('#drawer');
const switches=document.querySelectorAll('[data-panel]');
let selectedPanel=null;
function showPanel(name){
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
 welcome.close();connect();hall?.focus();
};
$('#name').addEventListener('input',()=>$('#name').setCustomValidity(''));
welcome.showModal();
