import {createVoiceChain} from './voice-chain.js';

export function createSingerMic({getSession,getUserMedia=()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false}),audioSession=globalThis.navigator?.audioSession,beforeStart=()=>{},chain=createVoiceChain,reverb=0.2,onState=()=>{},onLive=()=>{},onStop=()=>{},onLost=()=>{},onError=()=>{}}){
 let stream=null,raw=null,voice=null,wet=reverb,pending=false,generation=0,autoKey=null;
 let captureMode=false;
 function sessionMode(capture){
  if(!audioSession||!capture&&!captureMode)return;
  try{audioSession.type=capture?'play-and-record':'playback';captureMode=capture;}catch{}
 }
 const publish=()=>onState({stream,pending});
 const release=audio=>audio?.getTracks?.().forEach(track=>{track.onended=null;track.stop();});
 function stop(){
  generation++;pending=false;
  if(raw)release(raw);
  if(stream&&stream!==raw)release(stream);
  try{voice?.close();}catch{}
  stream=null;raw=null;voice=null;sessionMode(false);publish();onStop();
 }
 async function start(){
  const session=getSession();if(!session.allowed||!session.key||stream||pending)return;
  const own=generation;pending=true;publish();
  try{
   beforeStart();sessionMode(true);const audio=await getUserMedia(),current=getSession();
   if(own!==generation||!current.allowed||current.key!==session.key){release(audio);return;}
   raw=audio;stream=audio;pending=false;
   try{
    let processed=chain(audio,{reverb:wet});
    if(processed?.ready&&!(await processed.ready)){processed.close?.();processed=null;}
    const latest=getSession();if(own!==generation||!latest.allowed||latest.key!==session.key){processed?.close?.();if(raw===audio){release(audio);raw=null;stream=null;}return;}
    if(processed?.stream?.getAudioTracks?.().length){voice=processed;stream=processed.stream;}
    else processed?.close?.();
   }catch{voice=null;stream=audio;}
   for(const track of audio.getAudioTracks())track.onended=()=>{if(raw===audio){stop();onLost();}};
   publish();onLive();
  }catch(error){if(own===generation&&getSession().key===session.key&&getSession().allowed)onError(error);}
  finally{if(own===generation){pending=false;if(!stream)sessionMode(false);publish();}}
 }
 return {start,stop,setReverb(value){wet=Math.max(0,Math.min(1,Number(value)||0));try{voice?.setReverb(wet);}catch{}},auto(){const session=getSession();if(session.allowed&&session.key&&session.key!==autoKey){autoKey=session.key;if(stream){onLive();return;}return start();}}};
}
