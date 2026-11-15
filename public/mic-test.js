// Local-only microphone diagnostics. Never connects to a peer or uploads audio.
export function createMicTest({mediaDevices=globalThis.navigator?.mediaDevices,
 AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,
 MediaRecorder=globalThis.MediaRecorder,urls=globalThis.URL,
 setTimer=setTimeout,clearTimer=clearTimeout,raf=globalThis.requestAnimationFrame,
 cancelRaf=globalThis.cancelAnimationFrame,onState=()=>{},onLevel=()=>{}}={}){
 let generation=0,stream,context,source,analyser,recorder,timer,frame,url,phase='idle';
 const state=(value,message)=>{phase=value;onState({phase,message,url,canRecord:!!MediaRecorder});};
 const release=()=>{
  clearTimer(timer);timer=undefined;cancelRaf?.(frame);frame=undefined;
  if(recorder){recorder.ondataavailable=recorder.onstop=recorder.onerror=null;if(recorder.state!=='inactive')try{recorder.stop();}catch{}recorder=null;}
  source?.disconnect();source=null;analyser=null;
  if(context){context.close().catch(()=>{});context=null;}
  if(stream){for(const track of stream.getTracks()){track.onended=null;track.stop();}stream=null;}
  onLevel(0);
 };
 function stop(){generation++;release();if(url){urls.revokeObjectURL(url);url=null;}state('idle','Mic đã tắt.');}
 function fail(message){release();state('error',message);}
 async function start(){
  stop();const own= generation;
  if(!mediaDevices?.getUserMedia||!AudioContext){state('error','Trình duyệt chưa hỗ trợ test mic. Hãy dùng HTTPS và trình duyệt mới.');return;}
  state('requesting','Cho phép truy cập micro trong thông báo của trình duyệt.');
  try{
   const captured=await mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(own!==generation){captured.getTracks().forEach(track=>track.stop());return;}
   stream=captured;
   for(const track of stream.getAudioTracks())track.onended=()=>{if(own===generation)fail('Micro đã bị ngắt kết nối. Kiểm tra thiết bị rồi thử lại.');};
   context=new AudioContext();await context.resume();if(own!==generation)return;
   source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=1024;
   source.connect(analyser); // Intentionally no connection to context.destination.
   const samples=new Uint8Array(analyser.fftSize);
   const tick=()=>{if(own!==generation||!analyser)return;analyser.getByteTimeDomainData(samples);let sum=0;for(const value of samples)sum+=((value-128)/128)**2;onLevel(Math.min(1,Math.sqrt(sum/samples.length)*4));frame=raf(tick);};
   state('listening',MediaRecorder?'Hãy nói thử. Thanh âm lượng sẽ nhảy khi mic thu được âm thanh.':'Mic đang hoạt động. Trình duyệt này chỉ hỗ trợ kiểm tra âm lượng.');tick();
  }catch(error){
   if(own!==generation)return;
   fail(error?.name==='NotAllowedError'?'Quyền micro bị từ chối. Cho phép micro trong cài đặt trang web rồi thử lại.':error?.name==='NotFoundError'?'Không tìm thấy micro. Hãy kết nối micro rồi thử lại.':error?.name==='NotReadableError'?'Không mở được micro. Kiểm tra thiết bị hoặc ứng dụng đang dùng mic.':'Chưa mở được micro. Kiểm tra quyền và thiết bị rồi thử lại.');
  }
 }
 function record(){
  if(phase!=='listening'||!stream||!MediaRecorder)return;
  const own=generation,chunks=[];
  try{
   const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported?.(type));
   const active=new MediaRecorder(stream,mimeType?{mimeType}:undefined);recorder=active;
   active.ondataavailable=event=>{if(own===generation&&event.data.size)chunks.push(event.data);};
   active.onerror=()=>{if(own===generation)fail('Không thu được âm thanh. Bật lại mic để thử lần nữa.');};
   active.onstop=()=>{
    if(own!==generation)return;
    const blob=new Blob(chunks,{type:active.mimeType||chunks[0]?.type||'audio/webm'});release();
    if(!blob.size){state('error','Bản thu trống. Bật lại mic để thử lần nữa.');return;}
    url=urls.createObjectURL(blob);state('ready','Đã thu xong và tắt mic. Bấm phát bên dưới để nghe lại.');
   };
   active.start();state('recording','Đang thu thử 5 giây… Hãy nói hoặc hát một đoạn ngắn.');
   timer=setTimer(()=>{if(own===generation&&active.state!=='inactive')active.stop();},5000);
  }catch{fail('Trình duyệt chưa thu được âm thanh. Bật lại mic để thử lại.');}
 }
 return {start,record,stop,get phase(){return phase;}};
}
