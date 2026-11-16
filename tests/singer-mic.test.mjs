import test from 'node:test';
import assert from 'node:assert/strict';
import {createSingerMic} from '../public/singer-mic.js';

const recording=()=>{const track={stops:0,stop(){this.stops++;},onended:null};return {track,getTracks:()=>[track],getAudioTracks:()=>[track]};};

test('consecutive singer turns reuse capture without switching iPhone audio mode or losing room mic announcement',async()=>{
 const modes=[],audio=recording();let session={key:'one',allowed:true},calls=0,live=0;
 const mic=createSingerMic({getSession:()=>session,audioSession:{set type(value){modes.push(value);}},getUserMedia:async()=>{assert.equal(modes.at(-1),'play-and-record');calls++;return audio;},onLive:()=>live++});
 await mic.auto();session={key:'two',allowed:true};await mic.auto();
 assert.equal(calls,1);assert.equal(live,2);assert.equal(audio.track.stops,0);assert.deepEqual(modes,['play-and-record']);
 session.allowed=false;mic.stop();assert.equal(audio.track.stops,1);assert.deepEqual(modes,['play-and-record','playback']);
 mic.stop();assert.equal(modes.length,2,'listener snapshots do not continually switch audio mode');
});

test('failed mic permission restores playback mode and unsupported audio session setters do not prevent singing',async()=>{
 const modes=[];const mic=createSingerMic({getSession:()=>({key:'one',allowed:true}),audioSession:{set type(value){modes.push(value);}},getUserMedia:async()=>{throw Error('denied');}});
 await mic.auto();assert.deepEqual(modes,['play-and-record','playback']);
 let live=false;const audio=recording(),fallback=createSingerMic({getSession:()=>({key:'two',allowed:true}),audioSession:{set type(value){throw Error('unsupported');}},getUserMedia:async()=>audio,onLive:()=>live=true});
 await fallback.auto();assert.equal(live,true);fallback.stop();assert.equal(audio.track.stops,1);
});

test('desktop and mobile auto open once per singing turn and respect manual mute',async()=>{
 let session={key:'one',allowed:true,mobile:false},calls=0,live=0;const audio=recording();
 const mic=createSingerMic({getSession:()=>session,getUserMedia:async()=>{calls++;return audio;},onLive:()=>live++});
 await mic.auto();assert.equal(calls,1);session.mobile=true;await mic.auto();assert.equal(calls,1);assert.equal(live,1);
 await mic.auto();assert.equal(calls,1);mic.stop();assert.equal(audio.track.stops,1);
 await mic.auto();assert.equal(calls,1,'manual mute is retained through room snapshots');
 session={...session,key:'two'};await mic.auto();assert.equal(calls,2);mic.stop();
 session={...session,key:'three',allowed:false};await mic.auto();assert.equal(calls,2,'spectators never capture a microphone');
});

test('late permission results cannot broadcast after the turn ends or override a newer request',async()=>{
 let session={key:'one',allowed:true,mobile:true},live=0;const grants=[],states=[];
 const mic=createSingerMic({getSession:()=>session,getUserMedia:()=>new Promise(resolve=>grants.push(resolve)),onLive:()=>live++,onState:s=>states.push(s)});
 const first=mic.auto();await mic.auto();assert.equal(grants.length,1,'no duplicate requests while pending');
 mic.stop();session.key='two';const second=mic.auto();const stale=recording();grants[0](stale);await first;
 assert.equal(stale.track.stops,1);assert.equal(live,0);assert.equal(states.at(-1).pending,true);
 const current=recording();grants[1](current);await second;assert.equal(live,1);assert.equal(states.at(-1).stream,current);
 mic.stop();assert.equal(current.track.stops,1);
});

test('permission denial is not retried by snapshots; manual retry and device disconnection work',async()=>{
 let calls=0,errors=0,lost=0;const audio=recording(),states=[];
 const mic=createSingerMic({getSession:()=>({key:'one',allowed:true,mobile:true}),getUserMedia:async()=>{if(++calls===1)throw Error('Permission denied');return audio;},onError:()=>errors++,onLost:()=>lost++,onState:s=>states.push(s)});
 await mic.auto();await mic.auto();assert.equal(calls,1);assert.equal(errors,1);assert.equal(states.at(-1).pending,false);
 await mic.start();assert.equal(calls,2);audio.track.onended();assert.equal(lost,1);assert.equal(states.at(-1).stream,null);
});
