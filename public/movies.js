import {createMoviePlayer} from './movie-player.js';
import {moviePosition} from './movie-state.js';

export function createMovies({getId,send,sendControl,getTarget,now,notice,onBlocked,onMount,unlockAudio}){
 const $=selector=>document.querySelector(selector);
 const controls=$('#movie-controls'),desktopHome=controls.parentElement,mobileControls=matchMedia('(pointer:coarse), (max-width:800px)');
 const placeControls=()=>{const parent=mobileControls.matches?$('#movie-controls-slot'):desktopHome;if(controls.parentElement!==parent)parent.append(controls);};
 mobileControls.addEventListener('change',placeControls);placeControls();
 let state={},connected=false,detail=null,request=null,requestTimer,selecting=null,selectionTimer;
 const player=createMoviePlayer({getTarget:()=>{onMount();$('#movie-feedback').hidden=false;$('#movie-feedback-text').textContent='Đang tải phim…';$('#movie-feedback-retry').hidden=true;return getTarget();},now,onBlocked,onReady:()=>{$('#movie-feedback').hidden=true;},onError:text=>{$('#movie-error').textContent=text;$('#movie-retry').hidden=false;$('#movie-feedback').hidden=false;$('#movie-feedback-text').textContent=text;$('#movie-feedback-retry').hidden=false;},onDuration:duration=>{if(state.hostId===getId())send({type:'movie-duration',key:state.movie?.key,duration});},onEnded:()=>{if(state.hostId===getId())control({paused:true,position:state.movie?.duration||moviePosition(state.movie,now())});}});
 function control(extra){if(!state.movie)return;sendControl({type:'movie-playback',key:state.movie.key,hostVersion:state.hostVersion,...extra});}
 function command(type,extra){sendControl({type,hostVersion:state.hostVersion,...extra});}
 function ask(type,extra){
  if(!connected)return notice('Đang chờ kết nối phòng.');
  if(request)return notice('Đang tải thông tin phim…');
  const requestId=crypto.randomUUID();if(!send({type,requestId,...extra}))return;
  request=requestId;$('#movie-search-status').textContent='Đang tải…';
  clearTimeout(requestTimer);requestTimer=setTimeout(()=>{request=null;$('#movie-search-status').textContent='Nguồn phim phản hồi chậm. Hãy thử lại.';},15000);
 }
 $('#movie-search-form').onsubmit=event=>{event.preventDefault();const query=$('#movie-query').value.trim();if(/^https?:\/\//i.test(query))ask('movie-detail',{slug:query});else ask('movie-search',{query});};
 $('#mode-movie').onclick=()=>command('room-mode',{mode:'movie'});
 $('#mode-karaoke').onclick=()=>command('room-mode',{mode:'karaoke'});
 $('#movie-play').onclick=()=>{if(!state.movie)return;unlockAudio();if(state.movie.paused)player.unlock(true);control({paused:!state.movie.paused});};
 for(const [selector,delta] of [['#movie-back',-15],['#movie-forward',15]])$(selector).onclick=()=>{if(!connected||state.hostId!==getId()||!state.movie)return;control({paused:state.movie.paused,delta});};
 $('#movie-seek').oninput=()=>{$('#movie-seek-value').textContent=format(Number($('#movie-seek').value));};
 $('#movie-seek').onchange=()=>{if(state.movie)control({paused:state.movie.paused,position:Number($('#movie-seek').value)});};
 $('#movie-retry').onclick=()=>{$('#movie-error').textContent='';$('#movie-retry').hidden=true;player.retry();};
 $('#movie-feedback-retry').onclick=()=>$('#movie-retry').click();
 $('#movie-unlock').onclick=()=>{unlockAudio();player.unlock();};
 $('#movie-fullscreen').onclick=()=>{unlockAudio();player.fullscreen();};
 $('#movie-choose').onclick=()=>{
  if(!connected||!detail||selecting)return;
  selecting=sendControl({type:'movie-select',slug:detail.slug,episode:$('#movie-episode').value,hostVersion:state.hostVersion});
  if(selecting){$('#movie-choose').disabled=true;selectionTimer=setTimeout(()=>{selecting=null;draw();},21000);}
 };
 function format(seconds){seconds=Math.floor(seconds||0);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
 function draw(){
  const mine=state.hostId===getId(),active=state.mode==='movie',playingWerewolf=state.mode==='werewolf'&&!['lobby','ended'].includes(state.werewolf?.phase);
  $('#room-mode-status').textContent=state.mode==='werewolf'?'🐺 Đang ở bàn Ma Sói':state.pendingMode==='werewolf'?'🐺 Sẽ chuyển sang Ma Sói sau bài hát.':active?'🎬 Đang xem phim':state.pendingMode==='movie'?'🎬 Sẽ chuyển sang xem phim sau bài đang hát.':'🎤 Đang ở chế độ karaoke';
  $('#mode-movie').disabled=!connected||!mine||playingWerewolf||active||state.pendingMode==='movie';$('#mode-karaoke').disabled=!connected||!mine||playingWerewolf||state.mode==='karaoke'&&!state.pendingMode;
  $('#movie-host-help').textContent=mine?'Bạn điều khiển phim cho cả phòng. Chọn phim khi đang hát sẽ đợi hết bài rồi chuyển chế độ.':'Bạn có thể tìm phim; chủ phòng chọn tập và điều khiển phát cho cả phòng.';
  $('#movie-choose').disabled=!connected||!mine||!detail||!!selecting;
  $('#movie-watch').hidden=!active;$('#movie-controls').hidden=!active;
  $('#movie-now').textContent=state.movie?state.movie.title+' · '+state.movie.server+' · Tập '+state.movie.episode:state.pendingMovie?'Chờ chiếu: '+state.pendingMovie.title:'Chưa chọn phim.';
  $('#movie-play').disabled=!connected||!mine||!state.movie;$('#movie-play').textContent=state.movie?.paused?'▶ Phát phim':'⏸ Tạm dừng';
  $('#movie-back').disabled=$('#movie-forward').disabled=!connected||!mine||!state.movie;
  $('#movie-seek').disabled=!connected||!mine||!state.movie?.duration;
  $('#movie-seek').max=state.movie?.duration||0;
  $('#movie-fullscreen').disabled=!state.movie;
  $('#movie-unlock').hidden=!state.movie;
 }
 return {
  get adapter(){return player.adapter;},unlock(){player.unlock();},
  connected(value){connected=value;if(!value){clearTimeout(requestTimer);clearTimeout(selectionTimer);request=selecting=null;}draw();},
  render(next){const changed=state.movie?.key!==next.movie?.key;state=next;if(changed){$('#movie-error').textContent='';$('#movie-retry').hidden=true;}if(next.mode!=='movie')$('#movie-feedback').hidden=true;draw();player.update(next.mode==='movie'?next.movie:null);},
  receive(message){
   if(message.type==='control-result'){if(message.requestId===selecting){clearTimeout(selectionTimer);selecting=null;draw();if(message.accepted)notice(message.snapshot?.pendingMode?'Đã chọn phim. Sẽ chiếu sau bài đang hát.':'Đã chọn phim. Chủ phòng bấm Phát phim để bắt đầu.');}return;}
   if(message.requestId!==request)return;clearTimeout(requestTimer);request=null;
   if(message.error){$('#movie-search-status').textContent=message.error;return;}
   if(message.detail){detail=message.detail;$('#movie-detail').hidden=false;$('#movie-detail-title').textContent=detail.title;$('#movie-episode').replaceChildren();for(const episode of detail.episodes){const option=document.createElement('option');option.value=episode.id;option.textContent=episode.server+' · Tập '+episode.name;$('#movie-episode').append(option);}$('#movie-search-status').textContent='Chọn phiên bản và tập muốn xem.';draw();return;}
   $('#movie-results').replaceChildren();$('#movie-search-status').textContent=message.items?.length?'Chọn phim để xem danh sách tập.':'Không tìm thấy phim.';
   for(const item of message.items||[]){const button=document.createElement('button');button.type='button';button.className='movie-result';if(item.poster){const image=document.createElement('img');image.src=item.poster;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';button.append(image);}const label=document.createElement('span');label.textContent=item.title+(item.year?' ('+item.year+')':'');button.append(label);button.onclick=()=>ask('movie-detail',{slug:item.slug});$('#movie-results').append(button);}
  },
  tick(){if(document.activeElement!==$('#movie-seek')){$('#movie-seek').value=moviePosition(state.movie,now());$('#movie-seek-value').textContent=format(moviePosition(state.movie,now()));}},
  close(){mobileControls.removeEventListener('change',placeControls);clearTimeout(requestTimer);clearTimeout(selectionTimer);player.close();}
 };
}
