import test from 'node:test';
import assert from 'node:assert/strict';
import {createMicTest} from '../public/mic-test.js';

function fixture(overrides={}){
 const states=[],levels=[],revoked=[],connections=[],timers=new Map();let timerId=0,recorder,closed=0,stopped=0;
 const track={stop(){stopped++;},onended:null},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 class Context{
  resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}
  createMediaStreamSource(value){assert.equal(value,stream);return {connect(target){connections.push(target);},disconnect(){}};}
  createAnalyser(){return {fftSize:1024,getByteTimeDomainData(samples){samples.fill(160);}};}
 }
 class Recorder{
  static isTypeSupported(type){return type==='audio/mp4';}
  constructor(value,options){assert.equal(value,stream);this.mimeType=options.mimeType;this.state='inactive';recorder=this;}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test audio'],{type:this.mimeType})});this.onstop?.();}
 }
 const tester=createMicTest({mediaDevices:{getUserMedia:async constraints=>{assert.equal(constraints.video,false);return stream;}},AudioContext:Context,MediaRecorder:Recorder,
  urls:{createObjectURL(blob){assert.equal(blob.type,'audio/mp4');return 'blob:local-test';},revokeObjectURL(url){revoked.push(url);}},
  setTimer(callback,ms){assert.equal(ms,5000);timers.set(++timerId,callback);return timerId;},clearTimer(id){timers.delete(id);},raf:()=>1,cancelRaf:()=>{},
  onState:value=>states.push(value),onLevel:value=>levels.push(value),...overrides});
 return {tester,track,stream,states,levels,revoked,connections,timers,get recorder(){return recorder;},get stopped(){return stopped;},get closed(){return closed;}};
}

test('mic test measures locally, records five seconds, releases capture and revokes playback on close',async()=>{
 const f=fixture();await f.tester.start();assert.equal(f.tester.phase,'listening');
 assert.ok(f.levels.at(-1)>0);assert.equal(f.connections.length,1,'only the analyser is connected; no speaker or peer');
 f.tester.record();assert.equal(f.tester.phase,'recording');assert.equal(f.timers.size,1);
 [...f.timers.values()][0]();assert.equal(f.tester.phase,'ready');
 assert.equal(f.states.at(-1).url,'blob:local-test');assert.equal(f.stopped,1);assert.equal(f.closed,1);assert.equal(f.timers.size,0);
 f.tester.stop();assert.deepEqual(f.revoked,['blob:local-test']);assert.equal(f.tester.phase,'idle');
});

test('closing while permission is pending stops late streams and cannot reopen the tester',async()=>{
 let grant;const f=fixture({mediaDevices:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
 const pending=f.tester.start();assert.equal(f.tester.phase,'requesting');f.tester.stop();grant(f.stream);await pending;
 assert.equal(f.tester.phase,'idle');assert.equal(f.stopped,1);assert.equal(f.connections.length,0);
});

test('cancelled recording cannot create playback; errors and unplugged devices release capture',async()=>{
 const f=fixture();await f.tester.start();f.tester.record();const late=f.recorder.onstop;
 f.tester.stop();late();assert.equal(f.tester.phase,'idle');assert.ok(!f.states.at(-1).url);assert.equal(f.timers.size,0);
 await f.tester.start();f.track.onended();assert.equal(f.tester.phase,'error');assert.equal(f.stopped,2);
 await f.tester.start();f.tester.record();f.recorder.onerror();assert.equal(f.tester.phase,'error');assert.equal(f.stopped,3);
});

test('permission rejection, missing hardware and unsupported recording have usable states',async()=>{
 for(const name of ['NotAllowedError','NotFoundError','NotReadableError']){
  const f=fixture({mediaDevices:{getUserMedia:async()=>{throw {name};}}});await f.tester.start();
  assert.equal(f.tester.phase,'error');assert.ok(f.states.at(-1).message.length>20);assert.equal(f.connections.length,0);
 }
 const f=fixture({MediaRecorder:null});await f.tester.start();assert.equal(f.tester.phase,'listening');assert.equal(f.states.at(-1).canRecord,false);
 f.tester.record();assert.equal(f.tester.phase,'listening');f.tester.stop();assert.equal(f.stopped,1);
});
