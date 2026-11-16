export function createSingerMic({getSession,getUserMedia=()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}),beforeStart=()=>{},onState=()=>{},onLive=()=>{},onStop=()=>{},onLost=()=>{},onError=()=>{}}){
 let stream=null,pending=false,generation=0,autoKey=null;
 const publish=()=>onState({stream,pending});
 const release=audio=>audio.getTracks().forEach(track=>{track.onended=null;track.stop();});
 function stop(){generation++;pending=false;if(stream)release(stream);stream=null;publish();onStop();}
 async function start(){
  const session=getSession();if(!session.allowed||!session.key||stream||pending)return;
  const own=generation;pending=true;publish();
  try{
   beforeStart();const audio=await getUserMedia(),current=getSession();
   if(own!==generation||!current.allowed||current.key!==session.key){release(audio);return;}
   stream=audio;pending=false;
   for(const track of audio.getAudioTracks())track.onended=()=>{if(stream===audio){stop();onLost();}};
   publish();onLive();
  }catch(error){if(own===generation&&getSession().key===session.key&&getSession().allowed)onError(error);}
  finally{if(own===generation){pending=false;publish();}}
 }
 return {start,stop,auto(){const session=getSession();if(session.allowed&&session.key&&session.key!==autoKey){autoKey=session.key;return start();}}};
}
