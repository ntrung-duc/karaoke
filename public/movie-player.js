import {moviePosition} from './movie-state.js';

export function createMoviePlayer({getTarget,now,onBlocked,onError,onDuration,onEnded,onReady=()=>{},loadHls=()=>import('/lib/hls.mjs')}){
 let movie=null,video=null,hls=null,generation=0,lastSeek=-Infinity,lastCommand=null,failed=false,attempts=0,volume=30,muted=false,loadTimer;
 function destroy(){clearTimeout(loadTimer);generation++;hls?.destroy();hls=null;if(video){video.pause();video.removeAttribute('src');video.load();video.remove();}video=null;lastCommand=null;failed=false;}
 function play(){if(video&&!failed)video.play().catch(error=>{if(error.name==='NotAllowedError')onBlocked();});}
 function sync(){
  if(!movie||!video||failed||video.readyState<1)return;
  const target=moviePosition(movie,now()),command=movie.key+':'+movie.updatedAt+':'+movie.paused;
  if(Math.abs(video.currentTime-target)>1.2&&(command!==lastCommand||performance.now()-lastSeek>8000)){
   video.currentTime=target;lastSeek=performance.now();
  }
  lastCommand=command;
  if(movie.paused){video.pause();}else if(video.paused&&(!Number.isFinite(video.duration)||target<video.duration-.25))play();
 }
 async function mount(){
  destroy();if(!movie)return;
  const own=generation,element=video=document.createElement('video');
  element.setAttribute('playsinline','');element.preload='auto';element.style.cssText='display:block;width:100%;height:100%;object-fit:contain;background:#000';element.muted=muted;element.volume=volume/100;
  const target=getTarget();if(!target){onError('Chưa mở được màn hình phim. Hãy tải lại trang.');return;}target.append(element);
  loadTimer=setTimeout(()=>{if(own===generation&&element.readyState<1){failed=true;hls?.stopLoad();onError('Nguồn phim phản hồi quá lâu hoặc chặn truy cập từ mạng/khu vực này. Hãy tải lại hoặc chọn phiên bản khác.');}},25000);
  element.addEventListener('loadedmetadata',()=>{if(own!==generation)return;clearTimeout(loadTimer);failed=false;onReady();if(Number.isFinite(element.duration))onDuration(element.duration);sync();});
  element.addEventListener('canplay',()=>{if(own===generation)sync();});
  element.addEventListener('ended',()=>{if(own===generation)onEnded();});
  element.addEventListener('error',()=>{if(own===generation&&!hls){failed=true;onError('Nguồn phim không phát được. Bấm tải lại hoặc chọn nguồn/tập khác.');}});
  const nativeHls=!!element.canPlayType('application/vnd.apple.mpegurl');
  if(nativeHls&&(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){element.src=movie.source;return;}
  try{
   const {default:Hls}=await loadHls();if(own!==generation)return;
   if(!Hls.isSupported()){if(nativeHls){element.src=movie.source;return;}throw new Error('unsupported');}
   const engine=hls=new Hls({workerPath:'/lib/hls.worker.js',maxBufferLength:30,maxMaxBufferLength:60,capLevelToPlayerSize:true});attempts=0;
   engine.on(Hls.Events.ERROR,(_,data)=>{
    if(own!==generation||!data.fatal)return;
    if(attempts++<2){if(data.type===Hls.ErrorTypes.NETWORK_ERROR){engine.startLoad();return;}if(data.type===Hls.ErrorTypes.MEDIA_ERROR){engine.recoverMediaError();return;}}
    failed=true;engine.stopLoad();onError('Không tải được nguồn phim (mạng, nguồn hoặc CORS). Bấm tải lại hoặc chọn bản khác.');
   });
   engine.loadSource(movie.source);engine.attachMedia(element);
  }catch{if(own===generation){failed=true;onError('Chưa tải được trình phát phim. Bấm tải lại để thử.');}}
 }
 const timer=setInterval(sync,500);
 return {
  update(next){const changed=next?.key!==movie?.key;movie=next;if(changed)mount();else sync();},
  retry(){mount();},unlock(force=false){if(force||!movie?.paused)play();},
  fullscreen(){if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();else video?.requestFullscreen?.().catch(()=>{});},
  get adapter(){return {setVolume(value){volume=value;if(video)video.volume=value/100;},mute(){muted=true;if(video)video.muted=true;},unMute(){muted=false;if(video)video.muted=false;},playVideo:play};},
  close(){clearInterval(timer);destroy();}
 };
}
