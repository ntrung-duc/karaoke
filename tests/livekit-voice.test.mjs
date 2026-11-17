import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {createLivekitVoice} from '../public/livekit-voice.js';
import {createApplication} from '../server/application.mjs';

function fixture(){
 const rooms=[],sent=[],attached=[];let session={id:'singer',owner:'singer',key:'one',connected:true},stream=null;
 class Room extends EventEmitter{
  canPlaybackAudio=true;publications=[];stopped=[];
  constructor(){super();rooms.push(this);this.localParticipant={publishTrack:async track=>{this.publications.push(track);},unpublishTrack:async track=>{this.stopped.push(track);}};}
  async connect(url,token){this.url=url;this.token=token;}
  async disconnect(){this.disconnected=true;this.emit('disconnected');}
  async startAudio(){this.unlocked=true;}
 }
 const events={TrackSubscribed:'track',TrackUnsubscribed:'untrack',Reconnecting:'reconnecting',Reconnected:'reconnected',Disconnected:'disconnected',AudioPlaybackStatusChanged:'audio-status'};
 const voice=createLivekitVoice({send:m=>{sent.push(m);return true;},getSession:()=>session,getStream:()=>stream,onAudio:element=>attached.push(element),onBlocked(){},loadSdk:async()=>({Room,RoomEvent:events,Track:{Source:{Microphone:'microphone'},Kind:{Audio:'audio'}}})});
 return {voice,rooms,sent,attached,setSession(value){session=value;},setStream(value){stream=value;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('singer publishes only one processed track and manual mute unpublishes it',async t=>{
 const f=fixture(),clone={stop(){this.stopped=true;}},source={clone:()=>clone};t.after(()=>f.voice.close());f.setStream({getAudioTracks:()=>[source]});
 f.voice.configure(true);assert.equal(f.sent[0].type,'voice-session');await f.voice.credentials({key:'one',url:'wss://example',token:'test'});await settle();
 assert.equal(f.rooms[0].publications.length,1);f.voice.sync();await settle();assert.equal(f.rooms[0].publications.length,1);
 f.setStream(null);f.voice.sync();await settle();assert.equal(f.rooms[0].stopped.length,1);assert.equal(clone.stopped,true);f.voice.close();
});

test('audience hears only current singer and old-turn events cannot attach audio',async()=>{
 const previous=globalThis.document;globalThis.document={body:{append(){}}};
 const f=fixture();f.setSession({id:'viewer',owner:'singer',key:'one',connected:true});
 try{
  f.voice.configure(true);await f.voice.credentials({key:'one',url:'wss://example',token:'one'});
  const element={setAttribute(){},play:()=>Promise.resolve(),pause(){},remove(){}};
  const track={kind:'audio',attach:()=>element,detach(){}};
  f.rooms[0].emit('track',track,{trackSid:'a'},{identity:'wrong'});assert.equal(f.attached.length,0);
  f.rooms[0].emit('track',track,{trackSid:'a'},{identity:'singer'});assert.equal(f.voice.audio.length,1);
  f.voice.unlock();await settle();assert.equal(f.rooms[0].unlocked,true);
  f.setSession({id:'viewer',owner:'next',key:'two',connected:true});f.voice.sync();assert.equal(f.voice.audio.length,0);assert.equal(f.rooms[0].disconnected,true);
  await f.voice.credentials({key:'two',url:'wss://example',token:'two'});
  f.rooms[0].emit('track',track,{trackSid:'late'},{identity:'singer'});assert.equal(f.voice.audio.length,0);
  f.rooms[1].emit('track',track,{trackSid:'b'},{identity:'next'});assert.equal(f.voice.audio.length,1);assert.equal(f.rooms[1].publications.length,0);
 }finally{f.voice.close();globalThis.document=previous;}
});

test('LiveKit SDK endpoint has JavaScript MIME type and cannot expose project secrets',async t=>{
 const app=createApplication({ice:[]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const response=await fetch(base+'/lib/livekit-client.js');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/javascript/);assert.ok((await response.text()).length>1000);
 assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server/config.mjs')).status,404);
});
