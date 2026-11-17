// One outgoing microphone stream; LiveKit distributes it to the room.
export function createLivekitVoice({send,getSession,getStream,onAudio,onBlocked,onChange=()=>{}}){
 let enabled=false,key=null,identity=null,room=null,sdk=null,connecting=false,requestedAt=0,generation=0,published=null,publishedSource=null,publishing=false,status='idle';
 const audio=new Map();
 const report=value=>{status=value;onChange();};
 function clearAudio(){for(const {track,element} of audio.values()){track.detach(element);element.pause();element.srcObject=null;element.remove();}audio.clear();}
 function reset(){generation++;connecting=false;requestedAt=0;clearAudio();const old=room;room=null;published?.stop();published=publishedSource=null;publishing=false;if(old)old.disconnect().catch(()=>{});report('idle');}
 function request(){const session=getSession();if(!enabled||!key||!session.connected||connecting||Date.now()-requestedAt<8000)return;requestedAt=Date.now();send({type:'voice-session',key});report('connecting');}
 async function publish(){
  if(!room||status!=='connected'||publishing)return;
  const session=getSession(),source=session.owner===session.id?getStream()?.getAudioTracks()[0]:null;
  if(source===publishedSource)return;
  const own=generation,current=room;publishing=true;
  try{
   if(published){const old=published;published=publishedSource=null;await current.localParticipant.unpublishTrack(old,false);old.stop();}
   if(own!==generation||!source)return;
   const track=source.clone();
   try{await current.localParticipant.publishTrack(track,{source:sdk.Track.Source.Microphone,name:'singer',audioPreset:{maxBitrate:48000},dtx:true,red:true});}
   catch(error){track.stop();throw error;}
   if(own!==generation){track.stop();return;}
   published=track;publishedSource=source;
  }catch{if(own===generation){reset();requestedAt=Date.now();report('error');}}
  finally{if(own===generation){publishing=false;onChange();}}
 }
 function sync(){
  const session=getSession(),next=enabled?session.key:null;
  if(next!==key||session.id!==identity){reset();key=next;identity=session.id;}
  if(!key)return;
  if(!room&&!connecting)request();else if(status==='connected')publish();
 }
 async function credentials(message){
  if(!enabled||message.key!==key||connecting||room)return;
  const own=generation;connecting=true;
  try{
   sdk=await import('/lib/livekit-client.js');if(own!==generation)return;
   const current=room=new sdk.Room({disconnectOnPageLeave:true});
   current.on(sdk.RoomEvent.TrackSubscribed,(track,publication,participant)=>{
    if(own!==generation||track.kind!==sdk.Track.Kind.Audio||participant.identity!==getSession().owner)return;
    const element=track.attach();element.hidden=true;element.autoplay=true;element.setAttribute('playsinline','');document.body.append(element);audio.set(publication.trackSid,{track,element});onAudio(element);element.play().catch(onBlocked);onChange();
   });
   current.on(sdk.RoomEvent.TrackUnsubscribed,(track,publication)=>{const entry=audio.get(publication.trackSid);if(entry){track.detach(entry.element);entry.element.pause();entry.element.srcObject=null;entry.element.remove();audio.delete(publication.trackSid);}onChange();});
   current.on(sdk.RoomEvent.Reconnecting,()=>{if(own===generation)report('connecting');});
   current.on(sdk.RoomEvent.Reconnected,()=>{if(own===generation){report('connected');publish();}});
   current.on(sdk.RoomEvent.Disconnected,()=>{if(own===generation){reset();report('error');}});
   await current.connect(message.url,message.token,{autoSubscribe:true});
   if(own!==generation){await current.disconnect();return;}
   connecting=false;report('connected');publish();
  }catch{if(own===generation){reset();requestedAt=Date.now();report('error');}}
 }
 const timer=setInterval(sync,1000);
 return {configure(on){enabled=on;sync();},sync,credentials,get enabled(){return enabled;},get status(){return status;},get audio(){return [...audio.values()].map(entry=>entry.element);},retry(){if(room&&status==='connected'&&audio.size){room.startAudio().catch(onBlocked);for(const {element} of audio.values())element.play().catch(onBlocked);return;}reset();sync();},close(){clearInterval(timer);key=null;reset();}};
}
