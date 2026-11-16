import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createServerClock} from '../public/server-clock.js';
import {createVideoSync,createPlayheadReporter,songElapsed} from '../public/playback.js';
import {emptyRoom,joinMember,applyMessage,finishSong} from '../server/room-state.mjs';
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

test('spectators correct subsecond drift with a cooldown and catch up after buffering; singer is never repeatedly sought',()=>{
 let time=0;const f=playerFixture(),sync=createVideoSync(()=>time),song={key:'a',owner:'singer',video:'abcdefghijk',start:0};
 const run=(id='viewer',s=song,now=6000)=>sync.sync({song:s,id,player:f.player,now});
 run();f.calls.length=0;f.set(1,5.4);run();assert.deepEqual(f.calls,[['seek',6]]);
 time=1000;run();assert.equal(f.calls.length,1,'no seek storm');time=3000;f.set(3,2);run();assert.equal(f.calls.length,1,'do not seek a loading player');
 f.set(1,2);run();assert.deepEqual(f.calls.at(-1),['seek',6]);
 f.calls.length=0;time=6000;run('singer');assert.deepEqual(f.calls,[],'actual singer playback is the master');
 const waiting={...song,buffering:true,playhead:{position:5,at:5000}};run('viewer',waiting,10000);assert.ok(f.calls.some(c=>c[0]==='pause'));assert.equal(songElapsed(waiting,50000),5);
 f.calls.length=0;f.set(2,5);run('viewer',waiting);assert.ok(!f.calls.some(c=>c[0]==='play'));
 run('viewer',{...song,start:5000},10000);assert.ok(f.calls.some(c=>c[0]==='play'));
});

test('manual pause and queued starts never auto play; reporter is singer-only, bounded and responsive to buffering',()=>{
 let time=1000;const f=playerFixture(),sent=[],reporter=createPlayheadReporter(m=>sent.push(m),()=>time),song={key:'a',owner:'singer',video:'abcdefghijk',start:0};
 const report=(id='singer',s=song)=>reporter.check({song:s,id,player:f.player});
 report('viewer');assert.equal(sent.length,0);report();assert.equal(sent.length,1);report();assert.equal(sent.length,1);
 time=1250;f.set(3,1);report();assert.equal(sent.length,2);assert.equal(sent.at(-1).state,3);
 report('singer',{...song,pausedAt:1000});assert.equal(sent.length,2);
 const sync=createVideoSync(()=>time);sync.sync({song:{...song,pausedAt:1000},id:'singer',player:f.player,now:2000});assert.equal(f.calls[0][0],'cue');
 sync.sync({song:{...song,pausedAt:1000},id:'singer',player:f.player,now:3000});assert.ok(!f.calls.some(c=>c[0]==='play'));
});

test('only the singer can anchor playback; buffering cancels deadlines and manual pause preserves the buffered position',()=>{
 const room=emptyRoom();for(const id of ['a','b'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,m,now=2000)=>applyMessage(room,id,id,m,now);
 send('a',{type:'queue',video:'abcdefghijk'});const key=room.song.key;
 send('a',{type:'duration',key,video:'abcdefghijk',duration:20});send('a',{type:'playback',key,paused:false});
 const report={type:'playhead',key,video:'abcdefghijk',position:4,state:1,sampleAt:5900};
 send('b',report,6000);assert.equal(room.song.playhead,undefined);send('a',report,6000);assert.equal(room.song.start,1900);assert.equal(room.song.endAt,21900);
 send('a',{...report,position:5,state:3,sampleAt:6900},7000);assert.equal(room.song.endAt,undefined);assert.equal(songElapsed(room.song,50000),5);
 finishSong(room,key,30000);assert.equal(room.song.key,key);
 send('a',{type:'playback',key,paused:true},31000);assert.equal(songElapsed(room.song,40000),5);
 send('a',{type:'playback',key,paused:false},40000);assert.equal(songElapsed(room.song,40000),5);assert.equal(room.song.endAt,55000);
 send('a',{...report,key:'stale',position:99},41000);assert.equal(room.song.playhead,undefined);
});

test('synchronized start waits for actual singer playback instead of consuming song time during loading',()=>{
 const room=emptyRoom();joinMember(room,{id:'a',connectionId:'a',token:'a'},1000);
 const send=(m,time=2000)=>applyMessage(room,'a','a',m,time);
 send({type:'queue',video:'abcdefghijk'});const key=room.song.key;
 send({type:'duration',key,video:'abcdefghijk',duration:10});send({type:'playback',key,paused:false,sync:true});
 assert.equal(songElapsed(room.song,30000),0);assert.equal(room.song.endAt,undefined);
 send({type:'playhead',key,video:'abcdefghijk',position:.2,state:1,sampleAt:5000},5100);
 assert.equal(room.song.buffering,false);assert.equal(room.song.endAt,14800);
});

test('live clock probes and singer anchors reach clients; a late viewer receives the held playback position',async t=>{
 const app=createApplication({ice:[]}),sockets=[];app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{sockets.forEach(s=>s.terminate());await app.close();});
 async function wait(c,p){for(let i=0;i<200;i++){const m=c.messages.find(p);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw Error('Missing synchronization event');}
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/live?room=sync`),messages=[];sockets.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));const c={ws,messages};c.id=(await wait(c,m=>m.type==='hello')).id;return c;}
 const a=await connect(),send=m=>a.ws.send(JSON.stringify(m));send({type:'clock',seq:1});const pong=await wait(a,m=>m.type==='clock');assert.ok(Math.abs(pong.serverTime-Date.now())<1000);
 send({type:'queue',video:'abcdefghijk'});const song=(await wait(a,m=>m.type==='state'&&m.song)).song;
 send({type:'playback',key:song.key,paused:false});send({type:'playhead',key:song.key,video:song.video,position:3,state:3,sampleAt:Date.now()});
 await wait(a,m=>m.type==='state'&&m.song?.buffering);const b=await connect(),state=await wait(b,m=>m.type==='state'&&m.song?.buffering);
 assert.equal(songElapsed(state.song,Date.now()+60000),3);
});
