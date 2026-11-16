import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createServerClock} from '../public/server-clock.js';
import {createVideoSync,songElapsed,createVoiceDelay} from '../public/playback.js';
import {emptyRoom,joinMember,applyMessage,encodeRoom,decodeRoom} from '../server/room-state.mjs';
import {createApplication} from '../server/application.mjs';

test('clock uses RTT midpoint, prefers low-latency samples and ignores stale snapshots and wall-clock jumps',()=>{
 let time=0,wall=100000;const sent=[],clock=createServerClock({send:m=>{sent.push(m);return true;},wall:()=>wall,mono:()=>time});
 clock.request();time=200;assert.equal(clock.receive({seq:sent.at(-1).seq,serverTime:100100}),true);assert.equal(clock.now(),100200);
 clock.observe(90000);assert.equal(clock.now(),100200);
 time=1000;clock.request();time=1800;clock.receive({seq:sent.at(-1).seq,serverTime:101000});assert.equal(clock.now(),101800,'slower sample does not shift a better estimate');
 wall=0;time=2000;assert.equal(clock.now(),102000);assert.equal(clock.receive({seq:999,serverTime:100}),false);
});

function playerFixture(){
 const calls=[];let state=1,position=0;
 const player={getVideoData:()=>({video_id:'abcdefghijk'}),getCurrentTime:()=>position,getPlayerState:()=>state,getDuration:()=>100,
  loadVideoById:v=>calls.push(['load',v]),cueVideoById:v=>calls.push(['cue',v]),stopVideo:()=>calls.push(['stop']),seekTo:v=>calls.push(['seek',v]),pauseVideo:()=>calls.push(['pause']),playVideo:()=>calls.push(['play'])};
 return {calls,player,set(stateValue,positionValue){state=stateValue;position=positionValue;}};
}

test('audience video trails the singer for microphone latency; setting changes apply without delaying the singer',()=>{
 let time=0;const f=playerFixture(),sync=createVideoSync(()=>time),song={key:'a',owner:'singer',video:'abcdefghijk',start:0};
 const run=(id='viewer',delayMs=300,now=10000)=>sync.sync({song,id,player:f.player,now,delayMs});
 run();assert.equal(f.calls[0][1].startSeconds,9.7);f.calls.length=0;
 f.set(1,9.7);run();assert.deepEqual(f.calls,[]);
 run('viewer',500);assert.deepEqual(f.calls,[['seek',9.5]],'small compensation changes are not swallowed by the normal drift threshold');
 f.calls.length=0;time=3000;run('singer',500);assert.deepEqual(f.calls,[],'singer remains on the original timeline');
 const fresh=playerFixture(),start=createVideoSync(()=>time);
 start.sync({song,id:'viewer',player:fresh.player,now:100,delayMs:300});assert.equal(fresh.calls[0][0],'cue');assert.equal(fresh.calls[0][1].startSeconds,0);
 fresh.calls.length=0;fresh.set(5,0);start.sync({song,id:'viewer',player:fresh.player,now:1000,delayMs:300});assert.deepEqual(fresh.calls,[['seek',.7],['play']]);
});

test('microphone delay defaults to 300ms, persists locally, supports zero and bounds invalid values',()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},delay=createVoiceDelay(storage);
 assert.equal(delay.value,300);assert.equal(delay.set(550),550);assert.equal(createVoiceDelay(storage).value,550);
 assert.equal(delay.set(9999),2000);assert.equal(delay.set(0),0);assert.equal(createVoiceDelay(storage).value,0);
 assert.equal(delay.set('invalid'),0);assert.equal(createVoiceDelay({getItem(){throw Error('blocked');}}).value,300);
});

test('playing audience videos never seek or pause on jitter, periodic reports or singer buffering',()=>{
 const f=playerFixture(),sync=createVideoSync(),song={key:'a',owner:'singer',video:'abcdefghijk',start:0};
 sync.sync({song,id:'viewer',player:f.player,now:6000,delayMs:300});f.calls.length=0;
 for(let time=1000;time<60000;time+=1000){
  f.set(1,time/1000);
  sync.sync({song:{...song,buffering:time%3000===0,playhead:{position:0}},id:'viewer',player:f.player,now:time+6000,delayMs:300});
 }
 assert.deepEqual(f.calls,[],'even a large drift cannot cause recurring music cuts');
});

test('manual pause/resume seeks once; singer is unaffected by listener compensation',()=>{
 const f=playerFixture(),sync=createVideoSync(),song={key:'a',owner:'singer',video:'abcdefghijk',start:0,pausedAt:0};
 const run=(s,now,id='viewer')=>sync.sync({song:s,id,player:f.player,now,delayMs:300});
 run(song,1000);assert.equal(f.calls[0][0],'cue');f.calls.length=0;
 f.set(5,0);run(song,2000);assert.deepEqual(f.calls,[]);
 run({...song,pausedAt:undefined,start:2000},2100);assert.deepEqual(f.calls,[],'initial compensation window holds at zero');
 run({...song,pausedAt:undefined,start:2000},2500);assert.deepEqual(f.calls,[['seek',.2],['play']]);
 f.calls.length=0;f.set(1,.2);run({...song,pausedAt:undefined,start:2000},3000);assert.deepEqual(f.calls,[]);
 const singer=playerFixture();createVideoSync().sync({song:{...song,pausedAt:undefined},id:'singer',player:singer.player,now:6000,delayMs:1500});assert.equal(singer.calls[0][1].startSeconds,6);
});

test('old singer playhead reports cannot change the shared timeline or pause listeners',()=>{
 const room=emptyRoom();for(const id of ['a','b'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,m,now=2000)=>applyMessage(room,id,id,m,now);
 send('a',{type:'queue',video:'abcdefghijk'});const key=room.song.key;
 assert.ok(Number.isFinite(room.song.pausedAt),'new turn waits for the singer');
 send('a',{type:'duration',key,video:'abcdefghijk',duration:20});send('a',{type:'playback',key,paused:false,sync:true});
 assert.equal(room.song.start,2000);assert.equal(room.song.endAt,22000);assert.equal(room.song.buffering,undefined);
 for(const id of ['a','b'])send(id,{type:'playhead',key,video:'abcdefghijk',position:1,state:3},6000);
 assert.equal(room.song.start,2000);assert.equal(room.song.endAt,22000);assert.equal(room.song.buffering,undefined);
 send('a',{type:'playback',key,paused:true},7000);assert.equal(songElapsed(room.song,10000),5);
 send('a',{type:'playback',key,paused:false},10000);assert.equal(songElapsed(room.song,11000),6);
});

test('legacy rooms recover a deadline without keeping the old buffering hold',()=>{
 const room=emptyRoom();room.song={key:'old',start:1000,duration:30,buffering:true,playhead:{position:1}};
 const restored=decodeRoom(encodeRoom(room));assert.equal(restored.song.endAt,31000);assert.equal(restored.song.buffering,undefined);assert.equal(restored.song.playhead,undefined);
});

test('live clock probes and flower events reach room members, without replaying old flowers to late arrivals',async t=>{
 const app=createApplication({ice:[]}),sockets=[];app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{sockets.forEach(s=>s.terminate());await app.close();});
 async function wait(c,p){for(let i=0;i<200;i++){const m=c.messages.find(p);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw Error('Missing room event');}
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/live?room=sync`),messages=[];sockets.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));const c={ws,messages};c.id=(await wait(c,m=>m.type==='hello')).id;return c;}
 const a=await connect(),send=m=>a.ws.send(JSON.stringify(m));send({type:'clock',seq:1});const pong=await wait(a,m=>m.type==='clock');assert.ok(Math.abs(pong.serverTime-Date.now())<1000);
 send({type:'queue',video:'abcdefghijk'});const song=(await wait(a,m=>m.type==='state'&&m.song)).song;
 const b=await connect();await wait(b,m=>m.type==='state'&&m.song);
 b.ws.send(JSON.stringify({type:'flower',key:song.key}));const flower=await wait(a,m=>m.type==='flower');assert.deepEqual(await wait(b,m=>m.type==='flower'),flower);
 const c=await connect();await wait(c,m=>m.type==='state'&&m.song);assert.ok(!c.messages.some(m=>m.type==='flower'));
});
