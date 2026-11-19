import {projectPlayback} from './turn-state.js';
import {buildHall} from './hall.js';
import {roomName} from './session.js';
import {createAnimalPreview} from './animal-preview.js';
import {ANIMALS,animalId} from './animal-settings.js';
import {createConnection} from './connection.js';
import {createAudioOutput} from './audio-output.js';
import {createPlaybackMonitor,songElapsed,createVideoSync,createVoiceDelay} from './playback.js';
import {createServerClock} from './server-clock.js';
import {createChat} from './chat.js';
import {createSongQueue} from './song-queue.js';
import {createSongSearch} from './youtube-search.js';
import {createSingerMic} from './singer-mic.js';
import {createLivekitVoice} from './livekit-voice.js';
import {createRoomHost} from './room-host.js';
import {createMovies} from './movies.js';
const $=s=>document.querySelector(s),room=roomName(new URLSearchParams(location.search).get('room'));
function controlIcon(button,label,icon){
 const symbol=document.createElement('span');symbol.className='control-icon';symbol.setAttribute('aria-hidden','true');if(typeof icon==='string')symbol.textContent=icon;else symbol.append(icon);
 const text=document.createElement('span');text.className='control-label';text.textContent=label;button.replaceChildren(symbol,text);button.setAttribute('aria-label',label);button.title=label;
}
function microphoneIcon(on){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');
 const shape=document.createElementNS(ns,'path');shape.setAttribute('d','M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5 M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8');svg.append(shape);
 if(!on){const slash=document.createElementNS(ns,'path');slash.setAttribute('d','M3 3L21 21');slash.setAttribute('stroke','#ff4f63');slash.setAttribute('stroke-width','3');svg.append(slash);}return svg;
}
controlIcon($('#next'),'Bỏ qua bài','⏭');controlIcon($('#pause'),'Bắt đầu hát','▶');
let id='',connection,users=[],song=null,stream=null,ice=[],player=null,ready=false,connected=false;
let mode='karaoke',roomState={},movieStream=null,movieMicOpening=false;
let chosenAnimal=animalId(localStorage.getItem('rap-animal'));
const animalPicker=$('#animal-picker');let animalPreview;
for(const animal of ANIMALS){const option=document.createElement('option');option.value=animal.id;option.textContent=animal.icon+' '+animal.name;animalPicker.append(option);}animalPicker.value=chosenAnimal;
function selectAnimal(value){if(connected)return;chosenAnimal=animalId(value);animalPicker.value=chosenAnimal;localStorage.setItem('rap-animal',chosenAnimal);hall?.appearance(chosenAnimal);animalPreview?.show(chosenAnimal);}
animalPicker.onchange=()=>selectAnimal(animalPicker.value);
let noticeTimer;
const voiceRetries=new Map(),retiredVoices=new Set(),candidateBacklog=new Map(),voiceRequestAt=new Map();
const peers=new Map(),notice=(text,duration=3000)=>{clearTimeout(noticeTimer);$('#notice').textContent=text;if(duration>0)noticeTimer=setTimeout(()=>{if($('#notice').textContent===text)$('#notice').textContent='';},duration);};
let micOpening=false;
const mobileMic=()=>navigator.maxTouchPoints>0&&(matchMedia('(pointer:coarse)').matches||matchMedia('(max-width:800px)').matches);
function updateMicControls(){const film=mode==='movie',audio=film?movieStream:stream,opening=film?movieMicOpening:micOpening;for(const button of [$('#mic'),$('#singer-mic')]){button.disabled=!connected||(film?!voice.enabled:song?.owner!==id)||opening;controlIcon(button,opening?'Đang bật mic…':audio?'Tắt mic':'Bật mic',microphoneIcon(!!audio));button.setAttribute('aria-pressed',String(!!audio));}$('#singer-mic').hidden=!mobileMic();$('#mic-level-panel').hidden=!film&&song?.owner!==id;$('#mic-level-status').textContent=opening?'Đang mở micro…':audio?'Hãy nói hoặc hát để xem mức âm lượng.':film?'Bật mic để trò chuyện với mọi người.':song?.owner===id?'Mic đang tắt.':'Mic sẽ bật khi đến lượt hát.';}
function readReverb(){try{const saved=localStorage.getItem('rap-reverb'),value=Number(saved);return saved!==null&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):20;}catch{return 20;}}
const singerMic=createSingerMic({reverb:readReverb()/100,getSession:()=>({key:song?.key,allowed:mode==='karaoke'&&connected&&song?.owner===id,mobile:mobileMic()}),onState:state=>{stream=state.stream;micOpening=state.pending;updateMicControls();},onLive:()=>{send({type:'mic',on:true});if(!mobileMic())notice('Mic đã bật cho lượt hát của bạn.',3000);},onStop:()=>{for(const entry of peers.values())closePeer(entry);peers.clear();},onLost:()=>{send({type:'mic',on:false});notice('Mic đã ngắt. Bấm Bật mic để kết nối lại.');},onError:()=>notice('Chưa bật được mic. Cho phép micro rồi bấm Bật mic trên thanh điều khiển hoặc trong Phòng hát.')});
const movieMic=createSingerMic({reverb:0,getSession:()=>({key:roomState.movieVoiceKey,allowed:mode==='movie'&&connected&&voice.enabled,mobile:mobileMic()}),onState:state=>{movieStream=state.stream;movieMicOpening=state.pending;updateMicControls();},onLive:()=>{send({type:'mic',on:true});voice.sync();},onLost:()=>{send({type:'mic',on:false});notice('Mic trò chuyện đã ngắt. Bấm bật mic để thử lại.');},onError:()=>notice('Chưa mở được mic trò chuyện. Kiểm tra quyền micro của trình duyệt.')});
setInterval(()=>{const level=mode==='movie'?(movieStream?movieMic.level():0):(stream?singerMic.level():0);$('#mic-level').value=level;$('#mic-level-value').textContent=Math.round(level*100)+'%';},100);
const sound=$('#sound');
const audioUnlock=document.createElement('button');audioUnlock.id='audio-unlock';audioUnlock.textContent='▶ Bật nhạc và giọng hát';audioUnlock.hidden=true;document.querySelector('main').append(audioUnlock);
const output=createAudioOutput({storage:localStorage,getPlayer:()=>mode==='movie'?movies.adapter:ready&&song?player:null,canPlay:()=>mode==='movie'?!roomState.movie?.paused:!Number.isFinite(song?.pausedAt),getAudio:()=>[...voice.audio,...[...peers.values()].map(e=>e.audio).filter(Boolean)],onChange:({muted,label,musicVolume,voiceVolume})=>{for(const [kind,value] of [['music',musicVolume],['voice',voiceVolume]]){$('#'+kind+'-volume').value=value;$('#'+kind+'-volume-value').textContent=value+'%';}sound.querySelector('b').textContent=muted?'🔇':'🔊';sound.querySelector('span').textContent=label;sound.setAttribute('aria-label',label);sound.setAttribute('aria-pressed',String(muted));}});
const voice=createLivekitVoice({send,getSession:()=>({id,key:mode==='movie'?roomState.movieVoiceKey:song?.key,owner:song?.owner,group:mode==='movie',members:users.map(u=>u.id),connected}),getStream:()=>mode==='movie'?movieStream:stream,onAudio:audio=>output.attach(audio),onBlocked:()=>{output.block();if(!output.muted)audioUnlock.hidden=false;},onChange:()=>voiceStatus()});
const serverClock=createServerClock({send});
let videoSync=createVideoSync();const voiceDelay=createVoiceDelay(localStorage);
const delayPicker=$('#voice-delay');delayPicker.value=voiceDelay.value;$('#voice-delay-value').textContent=voiceDelay.value+' ms';
delayPicker.oninput=()=>{$('#voice-delay-value').textContent=delayPicker.value+' ms';};
delayPicker.onchange=()=>{delayPicker.value=voiceDelay.set(delayPicker.value);$('#voice-delay-value').textContent=voiceDelay.value+' ms';sync();};
const reverbPicker=$('#voice-reverb');reverbPicker.value=readReverb();$('#voice-reverb-value').textContent=reverbPicker.value+'%';
reverbPicker.oninput=()=>{$('#voice-reverb-value').textContent=reverbPicker.value+'%';singerMic.setReverb(reverbPicker.value/100);};
reverbPicker.onchange=()=>{try{localStorage.setItem('rap-reverb',reverbPicker.value);}catch{}};
const playback=createPlaybackMonitor(send);
const songQueue=createSongQueue({send});
const search=createSongSearch({send,notice,enqueue:(video,title)=>songQueue.submit(video,title)});
const chat=createChat({send,getId:()=>id,isOpen:()=>!$('#chat').hidden,notice});
output.apply();
$('#music-volume-help').hidden=!(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
sound.onclick=()=>{output.toggle();if(!output.muted){voice.unlock();audioUnlock.hidden=true;}notice('');};
audioUnlock.onclick=()=>{output.enable();voice.unlock();audioUnlock.hidden=true;};
for(const kind of ['music','voice'])$('#'+kind+'-volume').oninput=event=>output.setVolume(kind,event.target.value);
function send(m){return connection?.send(m)}
const pendingControls=new Map();
const roomHost=createRoomHost({getId:()=>id,sendControl,notice});
function destroyYouTube(){playerGeneration++;ready=false;try{player?.destroy();}catch{}player=null;}
const movies=createMovies({getId:()=>id,send,sendControl,getTarget:()=>hall?.playerTarget(),now:()=>serverClock.now(),notice,onBlocked:()=>{output.block();if(!output.muted)audioUnlock.hidden=false;},onMount:destroyYouTube,unlockAudio:()=>{output.enable();voice.unlock();}});
setInterval(()=>movies.tick(),1000);
let playbackIntent=null,authoritativeSong=null;
function sendControl(message){
 const requestId=crypto.randomUUID();
 if(!send({...message,requestId})){notice('Đang chờ kết nối phòng.');return false;}
 const timer=setTimeout(()=>{pendingControls.delete(requestId);if(playbackIntent?.requestId===requestId){playbackIntent=null;song=authoritativeSong;sync();}send({type:'refresh'});notice('Máy chủ chưa xác nhận thao tác. Đang cập nhật lại phòng.');},message.type==='movie-select'?20000:10000);
 pendingControls.set(requestId,timer);return requestId;
}
function receiveControl(message){
 movies.receive(message);
 roomHost.receive(message);
 if(!pendingControls.has(message.requestId))return;
 clearTimeout(pendingControls.get(message.requestId));pendingControls.delete(message.requestId);
 if(playbackIntent?.requestId===message.requestId)playbackIntent=null;
 if(message.snapshot)render(message.snapshot);
 if(!message.accepted)notice(message.error||'Máy chủ chưa nhận thao tác.');
}

let hall;try{hall=buildHall($('#view'),send,()=>id)}catch(e){notice('Trình duyệt cần bật WebGL để xem nhà hát');console.error(e)}
function stopMic(){singerMic.stop();}
window.addEventListener('pagehide',()=>{stopMic();movieMic.stop();movies.close();voice.close();serverClock.stop();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){serverClock.request();send({type:'refresh'});sync();}});
function closePeer(entry){clearTimeout(entry.retryTimer);clearTimeout(entry.requestTimer);if(entry.voiceId)retiredVoices.add(entry.voiceId);while(retiredVoices.size>128)retiredVoices.delete(retiredVoices.values().next().value);if(entry.audio){entry.audio.pause();entry.audio.srcObject=null;entry.audio.remove();}entry.pc.close();}
function requestVoice(other,force=false){
 if(voice.enabled){voice.sync();return true;}
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
 const status=$('#voice-status');$('#voice-retry').hidden=!song||song.owner===id&&!voice.enabled;
 if(mode==='movie'){$('#voice-retry').hidden=!voice.enabled;status.textContent=!voice.enabled?'Mic trò chuyện cần cấu hình LiveKit trên máy chủ.':voice.error|| (voice.status==='connected'?(movieStream?'Mic trò chuyện đang bật.':'Đã kết nối phòng trò chuyện. Bấm mic nếu muốn nói.'):'Đang kết nối âm thanh xem phim…');return;}
 if(!song){status.textContent='Chưa có người hát.';return;}
 if(voice.enabled){const live=voice.status==='connected';if(voice.error&&!live){status.textContent=voice.error;return;}status.textContent=song.owner===id?(!stream?'Micro đang tắt.':live?'Mic đang phát cho phòng.':'Đang kết nối micro tới phòng…'):!users.find(u=>u.id===song.owner)?.mic?'Người hát đang tắt mic.':live&&voice.audio.length?'Đã kết nối giọng hát.':voice.status==='error'?'Giọng hát bị gián đoạn. Bấm kết nối lại để thử.':'Đang kết nối giọng hát…';return;}
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
 if(voice.enabled||!stream||song?.owner!==id||!users.some(u=>u.id===other))return;
 const existing=peers.get(other);if(existing&&!['failed','closed'].includes(existing.pc.connectionState))return;
 if(existing){closePeer(existing);peers.delete(other);}
 const entry=link(other),{pc}=entry,turn=song?.key;
 try{stream.getTracks().forEach(t=>pc.addTrack(t,stream));await pc.setLocalDescription(await pc.createOffer());if(song?.key===turn&&peers.get(other)===entry)send({type:'signal',to:other,signal:{desc:pc.localDescription,key:turn,voiceId:entry.voiceId}});}
 catch(error){if(peers.get(other)===entry){closePeer(entry);peers.delete(other);}throw error;}
}
async function signal(m){
 if(voice.enabled)return;
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
let singerPosition=null,lastPositionAt=0,videoStalledAt=0;
const videoRecovery=document.createElement('button');videoRecovery.id='video-recovery';videoRecovery.textContent='↻ Bật / tải lại video';videoRecovery.hidden=true;document.querySelector('main').append(videoRecovery);
const elapsed=()=>songElapsed(song,serverClock.now());
function checkPlayback(){if(ready&&song)playback.check({song,id,player,elapsed:elapsed()});}
function sync(){
 if(!ready)return;
 if(videoSync.sync({song,id,player,now:serverClock.now(),delayMs:voiceDelay.value,position:singerPosition})){output.apply();return;}
 checkPlayback();
}
let playerGeneration=0;
function createVideoPlayer(){
 if(mode==='movie')return;
 if(!hall||!globalThis.YT?.Player)return;
 const generation=++playerGeneration;ready=false;
 const old=player;player=null;try{old?.destroy();}catch{}
 videoSync=createVideoSync();
 const target=hall.playerTarget();
 player=new YT.Player(target,{width:'800',height:'450',playerVars:{playsinline:1,controls:0,disablekb:1,origin:location.origin},events:{
  onReady:event=>{if(generation!==playerGeneration)return;player=event.target;ready=true;player.getIframe().tabIndex=-1;output.apply();sync();},
  onStateChange:event=>{if(generation!==playerGeneration)return;if(event.data===1||event.data===5)output.apply();sync();},
  onAutoplayBlocked:()=>{if(generation!==playerGeneration)return;videoRecovery.hidden=false;output.block();if(!output.muted)audioUnlock.hidden=false;},
  onError:()=>{if(generation!==playerGeneration)return;videoRecovery.hidden=false;notice('YouTube không phát được video này. Bấm tải lại video hoặc chọn bài khác.');}
 }});
}
window.onYouTubeIframeAPIReady=createVideoPlayer;
function recreateVideo(){createVideoPlayer();}
window.addEventListener('karaoke-player-moved',recreateVideo);
videoRecovery.onclick=()=>{if(!song)return;if(!ready||player.getVideoData()?.video_id!==song.video){recreateVideo();return;}output.enable();voice.unlock();player.seekTo(Math.max(0,(singerPosition?.key===song.key&&singerPosition.start===song.start&&serverClock.now()-singerPosition.at<6000?singerPosition.position+(singerPosition.state===1?Math.max(0,serverClock.now()-singerPosition.at)/1000:0):elapsed())-(song.owner===id?0:voiceDelay.value/1000)),true);player.playVideo();};
const yt=document.createElement('script');yt.src='https://www.youtube.com/iframe_api';yt.onerror=()=>notice('Chưa kết nối được YouTube. Kiểm tra mạng để phát bài hát.');setInterval(()=>{if(song)sync()},1000);
setInterval(()=>{
 if(!song){videoRecovery.hidden=true;if(mode!=='movie')audioUnlock.hidden=true;videoStalledAt=0;return;}
 const playing=ready&&player?.getPlayerState()===1;
 if(playing){videoStalledAt=0;videoRecovery.hidden=true;}else if(!Number.isFinite(song.pausedAt)){if(!videoStalledAt)videoStalledAt=Date.now();if(Date.now()-videoStalledAt>8000)videoRecovery.hidden=false;}
 if(connected&&ready&&song.owner===id&&!Number.isFinite(song.pausedAt)&&player.getVideoData()?.video_id===song.video&&Date.now()-lastPositionAt>=1500){
  const state=player.getPlayerState();if([1,2,3].includes(state)){lastPositionAt=Date.now();send({type:'video-position',key:song.key,start:song.start,position:player.getCurrentTime(),state});}
 }
},1000);
$('#room-audio-unlock').onclick=()=>audioUnlock.click();
$('#room-video-retry').onclick=()=>{if(mode==='movie'){$('#movie-retry').click();return;}if(!song)return notice('Chưa có bài hát trên sân khấu.');videoRecovery.click();};
function row(parent,str,dim=false){const el=document.createElement('div');el.className='item'+(dim?' dim':'');el.textContent=str;parent.append(el);return el}
let renderedStateRevision=0;
function render(m){
 if(Number.isInteger(m.revision)){if(m.revision<renderedStateRevision)return;renderedStateRevision=m.revision;}
 const changedMode=mode!==(m.mode||'karaoke');mode=m.mode||'karaoke';roomState=m;
 if(changedMode){stopMic();movieMic.stop();if(mode==='movie')destroyYouTube();}
 const old=song;authoritativeSong=m.song;
 const projected=projectPlayback(m.song,playbackIntent);playbackIntent=projected.intent;song=projected.song;const mine=song?.owner===id;users=m.users;chat.history(m.chat||[]);if(song&&!yt.isConnected)document.head.append(yt);serverClock.observe(m.now);
 const changedTurn=old?.key!==song?.key;if(changedTurn){singerPosition=null;videoStalledAt=0;lastPositionAt=0;voiceRetries.clear();candidateBacklog.clear();voiceRequestAt.clear();}const keepMic=stream&&mine&&old?.owner===id;
 if(changedTurn&&keepMic){for(const entry of peers.values())closePeer(entry);peers.clear();}
 else if(changedTurn||stream&&!mine||!mine&&!users.find(u=>u.id===song?.owner)?.mic)stopMic();
 for(const [pid,e] of peers)if(!users.some(u=>u.id===pid)){closePeer(e);peers.delete(pid)}
 hall?.users(users,song?.owner,m.now);hall?.flowerTurn(song?.key??null);hall?.media(!!song||mode==='movie'&&!!m.movie,mode);const me=users.find(u=>u.id===id);
 movies.render(m);$('#media-panel-label').textContent='Chọn bài / Phim';$('#karaoke-picker').hidden=false;if(changedMode)$('#karaoke-picker').open=mode!=='movie';$('#music-volume-label').textContent=mode==='movie'?'Tiếng phim':'Nhạc nền';$('#voice-volume-label').textContent=mode==='movie'?'Trò chuyện':'Giọng hát';$('#karaoke-delay').hidden=mode==='movie';$('#local-audio-help').textContent=mode==='movie'?'Chỉ thay đổi tiếng phim và trò chuyện bạn nghe. Dùng tai nghe để tránh vọng tiếng.':'Chỉ thay đổi âm lượng bạn nghe. Nhạc nhỏ hơn giúp nghe rõ giọng hát.';if(changedMode)$('#movie-picker').open=mode==='movie';$('#listener-voice-volume').hidden=false;
 if(changedMode&&mode==='karaoke')createVideoPlayer();
 if(me?.animalChosen){chosenAnimal=animalId(me.animal);localStorage.setItem('rap-animal',chosenAnimal);}
 $('#singer-controls').hidden=!mine;$('#listener-voice-volume').hidden=mine;$('#singer-reverb').hidden=!mine;$('#throw-flower').hidden=!song||mine;$('#throw-flower').disabled=!connected;controlIcon($('#pause'),song?.awaitingStart?'Bắt đầu hát':Number.isFinite(song?.pausedAt)?'Tiếp tục':'Tạm dừng',Number.isFinite(song?.pausedAt)?'▶':'⏸');$('#pause').disabled=$('#next').disabled=!connected;updateMicControls();$('#sit').disabled=mine;$('#sit').hidden=me?.seat<0||!me;$('#sit').textContent='Đứng dậy';$('#total').textContent=users.length;$('#count').textContent=m.queue.length+(song?1:0);$('#songs').replaceChildren();
 roomHost.render(m);
 const ownerName=s=>users.find(u=>u.id===s.owner)?.name||'Khách';
 $('#turn-status').textContent=mode==='movie'?'Đang xem phim. Bạn có thể bật mic để trò chuyện.':!song?'Sân khấu đang trống. Chọn bài để đăng ký lượt hát.':mine?(song.awaitingStart?'Đến lượt bạn. Kiểm tra mic rồi bấm Bắt đầu hát.':Number.isFinite(song.pausedAt)?'Bài của bạn đang tạm dừng.':'Bạn đang hát.'):(song.awaitingStart?ownerName(song)+' đang chuẩn bị hát.':Number.isFinite(song.pausedAt)?'Bài hát đang tạm dừng.':ownerName(song)+' đang hát. Bạn có thể đăng ký bài tiếp theo.');
 if(song)row($('#songs'),'♫　'+song.title+' · '+ownerName(song)+(song.awaitingStart?' · Chờ bắt đầu':Number.isFinite(song.pausedAt)?' · Tạm dừng':' · Đang hát'));else row($('#songs'),'Sân khấu đang trống.',true);
 m.queue.forEach((s,i)=>row($('#songs'),(i+1)+'. '+s.title+' · '+ownerName(s),true));
 if(stream&&mine&&me?.mic)users.filter(u=>u.id!==id).forEach(u=>offer(u.id).catch(()=>notice('Chưa kết nối được mic tới một người nghe.')));
 else if(song&&!mine&&users.find(u=>u.id===song.owner)?.mic&&!peers.has(song.owner))requestVoice(song.owner);
 if(old?.key!==song?.key||old?.pausedAt!==song?.pausedAt){notice('');sync()}
 singerMic.auto();voice.sync();voiceStatus();output.apply();
}
function connect(){
 if(!room){$('#status').textContent='Tên phòng không hợp lệ';notice('Tên phòng dùng 1–48 chữ Latin, số, gạch ngang hoặc gạch dưới.');return;}
 connection=createConnection({room,
  onHello(m){renderedStateRevision=0;id=m.id;ice=m.ice;connected=true;voice.configure(m.voiceTransport==='livekit');hall?.reconnect();send({type:'name',value:$('#name').value});send({type:'appearance',animal:chosenAnimal});if(stream||movieStream)send({type:'mic',on:true});},
  onMessage(m){if(m.type==='movie-result'){movies.receive(m);}else if(m.type==='control-result'){receiveControl(m);}else if(m.type==='queue-result'){songQueue.receive(m);}else if(m.type==='video-position'){singerPosition=m;sync();}else if(m.type==='voice-session'){voice.credentials(m);}else if(m.type==='clock'){if(serverClock.receive(m))sync();}else if(m.type==='search-results')search.receive(m);else if(m.type==='state')render(m);else if(m.type==='chat'){chat.receive(m.entry);hall?.chat(m.entry);}else if(m.type==='flower')hall?.flower(m);else if(m.type==='pose'){hall?.peer(m.user);}else if(m.type==='signal')signal(m).catch(()=>notice('Kết nối giọng hát bị gián đoạn.'));},
  onStatus(status){
   movies.connected(status==='connected');
   roomHost.connected(status==='connected');
   chat.connected(status==='connected');$('#throw-flower').disabled=status!=='connected';
   if(status==='connected'){serverClock.start();$('#status').textContent='●　Trực tuyến';$('#pause').disabled=$('#next').disabled=false;updateMicControls();return;}
   serverClock.stop();search.disconnected();songQueue.disconnected();for(const timer of pendingControls.values())clearTimeout(timer);pendingControls.clear();playbackIntent=null;song=authoritativeSong;connected=false;updateMicControls();$('#pause').disabled=$('#next').disabled=true;
   // Keep capture and song time across Function rotation. Rebuild peers only
   // after the room acknowledges mic, so listeners see the state before offers.
   if(stream){for(const entry of peers.values())closePeer(entry);peers.clear();}
   $('#status').textContent=status==='connecting'?'Đang kết nối':'Đang kết nối lại';
  },onError:notice,
 });connection.connect();
}
$('#name').value=localStorage.getItem('rap-name')||'';$('#name').onchange=()=>{localStorage.setItem('rap-name',$('#name').value);send({type:'name',value:$('#name').value})};
$('#form').onsubmit=async e=>{e.preventDefault();if(!connected)return notice('Đang chờ kết nối phòng.');let v;try{const u=new URL($('#url').value.trim());if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))v=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)?.[1];else if(u.hostname==='youtu.be')v=u.pathname.slice(1)}catch{}if(!/^[\w-]{11}$/.test(v||''))return notice('Hãy dán liên kết đến một video YouTube.');const form=e.target,button=form.querySelector('button');button.disabled=true;try{await songQueue.submit(v,$('#title').value.trim()||'Karaoke · '+v);form.reset();notice('Phòng đã nhận bài hát.');}catch(error){notice(error.message);}finally{button.disabled=false;}};
$('#pause').onclick=()=>{
 if(song?.owner!==id){notice('Chỉ người đang đến lượt hát mới điều khiển được bài.');return;}
 if(playbackIntent){notice('Đang chờ xác nhận thao tác trước.');return;}
 if(!ready||player.getVideoData()?.video_id!==song.video){videoRecovery.hidden=false;notice('Video chưa sẵn sàng. Bấm tải lại video rồi bắt đầu hát.');return;}
 const paused=Number.isFinite(song.pausedAt);
 const now=serverClock.now(),previous=song,next={...song};
 if(paused){
  if(song.awaitingStart)next.start=now;
  else next.start=song.start+Math.max(0,now-song.pausedAt);
  delete next.pausedAt;delete next.awaitingStart;
  if(next.duration)next.endAt=next.start+next.duration*1000;
 }else{next.pausedAt=now;delete next.endAt;}
 const requestId=sendControl({type:'playback',key:song.key,paused:!paused});if(!requestId)return;
 playbackIntent={requestId,key:song.key,paused:!paused,song:next};song=next;
 controlIcon($('#pause'),paused?'Tạm dừng':'Tiếp tục',paused?'⏸':'▶');
 if(paused){
  // Start the iframe directly inside the singer's click. Waiting for the
  // server state round trip loses the browser's user-activation permission.
  if(ready&&player){player.seekTo(song.awaitingStart?0:elapsed(),true);player.playVideo();}
 }else player?.pauseVideo();
};
$('#camera').onclick=()=>hall?.camera();$('#sit').onclick=()=>hall?.seat();$('#next').onclick=()=>{if(song?.owner!==id){notice('Chỉ người đang đến lượt hát mới bỏ qua được bài.');return;}if(sendControl({type:'next',key:song.key}))notice('Đang bỏ qua bài…');};
$('#mic').onclick=()=>{if(mode==='movie'){if(movieStream){movieMic.stop();send({type:'mic',on:false});voice.sync();}else movieMic.start();return;}if(stream){stopMic();send({type:'mic',on:false});}else singerMic.start();};
$('#singer-mic').onclick=()=>$('#mic').click();
$('#voice-retry').onclick=()=>{output.enable();if(voice.enabled){voice.retry();return;}if(song?.owner!==id&&song){voiceRetries.delete(song.owner);requestVoice(song.owner,true);}};

let flowerAt=-Infinity;
$('#throw-flower').onclick=()=>{if(!connected||!song||song.owner===id||performance.now()-flowerAt<1200)return;if(send({type:'flower',key:song.key})){flowerAt=performance.now();hall?.focus();}};

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
  if(selected)$('#panel-title').textContent={music:'Chọn bài / Phim',room:'Phòng hát',chat:'Chat'}[name];
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
const helpDialog=$('#help-dialog');
$('#help-open').onclick=()=>{showPanel(null);helpDialog.showModal();};
$('#welcome-help').onclick=()=>helpDialog.showModal();
for(const id of ['help-close','help-done'])$('#'+id).onclick=()=>helpDialog.close();
helpDialog.addEventListener('close',()=>{if(!welcome.open)hall?.focus();});
profileForm.onsubmit=event=>{
 event.preventDefault();const name=$('#name').value.trim();
 $('#name').setCustomValidity(name?'':'Hãy nhập tên của bạn.');
 if(!profileForm.reportValidity())return;
 $('#name').value=name;selectAnimal(animalPicker.value);
 localStorage.setItem('rap-name',name);
 output.enable({restoreSilentLevels:true});welcome.close();animalPreview?.dispose();animalPreview=null;connect();hall?.focus();
};
$('#name').addEventListener('input',()=>$('#name').setCustomValidity(''));
try{animalPreview=createAnimalPreview($('#animal-preview'));animalPreview.show(chosenAnimal);}catch{$('#animal-preview').hidden=true;}
welcome.showModal();
