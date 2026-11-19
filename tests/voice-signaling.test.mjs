import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function closePeer('),app.indexOf('let singerPosition='));
function fixture(){
 const sent=[],timers=[],events=[];
 class Peer{
  connectionState='new';remoteDescription=null;localDescription=null;
  addTrack(){} close(){this.connectionState='closed';}
  async createOffer(){return {type:'offer',sdp:'offer'};}
  async createAnswer(){return {type:'answer',sdp:'answer'};}
  async setLocalDescription(value){this.localDescription=value;}
  async setRemoteDescription(value){events.push('sdp-start');await Promise.resolve();this.remoteDescription=value;events.push('sdp-end');}
  async addIceCandidate(){assert.ok(this.remoteDescription);events.push('ice');}
 }
 const context=vm.createContext({mode:'karaoke',voice:{enabled:false},RTCPeerConnection:Peer,MediaStream:class{},peers:new Map(),voiceRetries:new Map(),retiredVoices:new Set(),candidateBacklog:new Map(),voiceRequestAt:new Map(),crypto:{randomUUID},song:{key:'one',owner:'singer'},id:'viewer',stream:null,users:[{id:'singer',mic:true},{id:'viewer'}],ice:[],micOpening:false,
  $:()=>({textContent:''}),send:m=>sent.push(m),notice(){},output:{attach(){},block(){},muted:false},document:{createElement(){return {setAttribute(){},play:()=>Promise.resolve(),pause(){},remove(){}};},body:{append(){}}},setTimeout:fn=>timers.push(fn),clearTimeout(){}});
 vm.runInContext(source+';globalThis.api={link,signal,offer,closePeer};',context);
 return {context,sent,timers,events,api:context.api};
}
test('ICE and SDP arriving together are processed in order, and stale song signals are ignored',async()=>{
 const f=fixture();
 await f.api.signal({from:'singer',signal:{key:'previous',desc:{type:'offer'}}});assert.equal(f.context.peers.size,0);
 const offer=f.api.signal({from:'singer',signal:{key:'one',desc:{type:'offer'}}});
 const ice=f.api.signal({from:'singer',signal:{key:'one',candidate:{candidate:'test'}}});
 await Promise.all([offer,ice]);assert.deepEqual(f.events,['sdp-start','sdp-end','ice']);assert.equal(f.sent[0].signal.key,'one');assert.equal(f.sent[0].signal.desc.type,'answer');
});
test('failed singer links retry without recapturing the microphone and close the old peer',async()=>{
 const f=fixture();f.context.id='singer';f.context.stream={getTracks:()=>[{}],getAudioTracks:()=>[{label:'Headset'}]};
 await f.api.offer('viewer');const old=f.context.peers.get('viewer');old.pc.connectionState='failed';old.pc.onconnectionstatechange();assert.equal(f.timers.length,1);
 await f.timers[0]();await Promise.resolve();assert.notEqual(f.context.peers.get('viewer'),old);assert.equal(old.pc.connectionState,'closed');
});
test('received voice is attached to an inline DOM audio element and cleaned up on closing',async()=>{
 const f=fixture(),e=f.api.link('singer');let removed=false;
 e.pc.ontrack({streams:[{}],track:{}});assert.ok(e.audio);assert.equal(e.audio.autoplay,true);
 e.audio.remove=()=>removed=true;f.api.closePeer(e);assert.equal(removed,true);assert.equal(e.audio.srcObject,null);
});

test('new microphone ICE arriving before its offer cannot contaminate the previous connection',async()=>{
 const f=fixture();
 await f.api.signal({from:'singer',signal:{key:'one',voiceId:'old',desc:{type:'offer'}}});
 const old=f.context.peers.get('singer');
 await f.api.signal({from:'singer',signal:{key:'one',voiceId:'new',candidate:{candidate:'new-ice'}}});
 assert.equal(f.context.peers.get('singer'),old);assert.equal(f.context.candidateBacklog.size,1);
 await f.api.signal({from:'singer',signal:{key:'one',voiceId:'new',desc:{type:'offer'}}});
 const current=f.context.peers.get('singer');assert.notEqual(current,old);assert.equal(current.voiceId,'new');assert.equal(f.context.candidateBacklog.size,0);
 const count=f.events.length;
 await f.api.signal({from:'singer',signal:{key:'one',voiceId:'old',candidate:{candidate:'stale-ice'}}});
 await f.api.signal({from:'singer',signal:{key:'one',voiceId:'old',desc:{type:'offer'}}});
 assert.equal(f.events.length,count);assert.equal(f.context.peers.get('singer'),current);
});

test('listener can request a fresh offer without recapturing mic, with a rate limit',async()=>{
 const f=fixture();f.context.id='singer';f.context.stream={getTracks:()=>[{}],getAudioTracks:()=>[{label:'Test mic'}]};
 await f.api.offer('viewer');const old=f.context.peers.get('viewer');old.createdAt-=7000;
 await f.api.signal({from:'viewer',signal:{key:'one',retry:true}});
 const current=f.context.peers.get('viewer');assert.notEqual(current,old);
 await f.api.signal({from:'viewer',signal:{key:'one',retry:true}});assert.equal(f.context.peers.get('viewer'),current);
});
