export function createSingerMic({getSession,getUserMedia=()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}),audioSession=globalThis.navigator?.audioSession,beforeStart=()=>{},onState=()=>{},onLive=()=>{},onStop=()=>{},onLost=()=>{},onError=()=>{}}){
 let stream=null,pending=false,generation=0,autoKey=null,intent=false,intentKey=null;
 let captureMode=false;
 function sessionMode(capture){
  if(!audioSession||!capture&&!captureMode)return;
  try{audioSession.type=capture?'play-and-record':'playback';captureMode=capture;}catch{}
 }
 const publish=()=>onState({stream,pending});
 const release=audio=>audio.getTracks().forEach(track=>{track.onended=null;track.stop();});
 function stop({keepIntent=false}={}){generation++;if(!keepIntent)intent=false;pending=false;if(stream)release(stream);stream=null;sessionMode(false);publish();onStop();}
 async function start(){
  const session=getSession();if(!session.allowed||!session.key||stream||pending)return;
  const own=generation;intent=true;intentKey=session.key;pending=true;publish();
  try{
   beforeStart();sessionMode(true);const audio=await getUserMedia(),current=getSession();
   if(own!==generation||!current.allowed||current.key!==session.key){release(audio);return;}
   stream=audio;pending=false;
   for(const track of audio.getAudioTracks())track.onended=()=>{if(stream===audio){stop({keepIntent:true});onLost();}};
   publish();onLive();
  }catch(error){if(own===generation&&getSession().key===session.key&&getSession().allowed)onError(error);}
  finally{if(own===generation){pending=false;if(!stream){intent=false;sessionMode(false);}publish();}}
 }
 return {start,stop,recover(){const session=getSession();if(intent&&session.allowed&&session.key===intentKey&&!stream&&!pending)return start();},auto(){const session=getSession();if(session.allowed&&session.key&&session.key!==autoKey){autoKey=session.key;if(stream){intentKey=session.key;onLive();return;}return start();}}};
}

// devicechange can also be caused by camera/output changes or newly revealed
// permission labels. Restart capture only for an actual default-input change.
export function createDefaultMicWatcher(){
 let previous=null;
 return {check(devices,selected=''){
  const inputs=devices.filter(d=>d.kind==='audioinput'),device=inputs.find(d=>d.deviceId==='default')||inputs[0];
  const signature=device&&(device.groupId?'group:'+device.groupId:device.label?'label:'+device.label:device.deviceId!=='default'?'id:'+device.deviceId:null);
  const changed=!!previous&&!!signature&&previous.split(':')[0]===signature.split(':')[0]&&previous!==signature;
  previous=signature||previous;
  return selected?!inputs.some(d=>d.deviceId===selected):changed;
 }};
}
