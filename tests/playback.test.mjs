import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createAudioOutput} from '../public/audio-output.js';
import {createPlaybackMonitor,songElapsed} from '../public/playback.js';
import {createApplication} from '../server/application.mjs';
import {emptyRoom,joinMember,applyMessage,finishSong} from '../server/room-state.mjs';

test('only the singer can pause; the shared clock and deadline resume from the same position',()=>{
 const room=emptyRoom();for(const id of ['one','two'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,message,now)=>applyMessage(room,id,id,message,now);
 send('one',{type:'queue',video:'abcdefghijk'},1000);const key=room.song.key;
 send('one',{type:'duration',key,video:'abcdefghijk',duration:10},1100);
 send('two',{type:'playback',key,paused:true},5000);assert.equal(room.song.pausedAt,undefined);
 send('one',{type:'playback',key,paused:true},5000);
 assert.equal(room.song.endAt,undefined);const position=songElapsed(room.song,5000);
 assert.equal(songElapsed(room.song,20000),position);finishSong(room,key,20000);assert.equal(room.song.key,key);
 send('one',{type:'duration',key,video:'abcdefghijk',duration:10.5},20000);assert.equal(room.song.endAt,undefined);
 send('one',{type:'playback',key:'old',paused:false},20000);assert.equal(room.song.pausedAt,5000);
 send('one',{type:'playback',key,paused:false},20000);
 assert.equal(songElapsed(room.song,20000),position);assert.equal(room.song.endAt,room.song.start+10500);
 finishSong(room,key,room.song.endAt);assert.equal(room.song,null);
});

test('local mute covers the player, existing voice and future voice without stopping playback',()=>{
 const saved=new Map(),calls=[],voice={muted:false,play(){calls.push('voice-play');return Promise.resolve();}},audio=[voice];
 const player={mute(){calls.push('mute');},unMute(){calls.push('unmute');},playVideo(){calls.push('play');}};
 const storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
 const output=createAudioOutput({getPlayer:()=>player,getAudio:()=>audio,storage});
 output.toggle();assert.equal(output.muted,true);assert.equal(voice.muted,true);assert.deepEqual(calls,['mute']);
 const later={muted:false};output.attach(later);assert.equal(later.muted,true);
 assert.equal(createAudioOutput({storage}).muted,true,'mute persists across reload');
 output.toggle();assert.equal(voice.muted,false);assert.ok(calls.includes('unmute'));assert.ok(calls.includes('voice-play'));
 output.block();output.toggle();assert.equal(output.muted,false,'autoplay recovery enables sound rather than muting it');
});

test('ended video polling retries safely and ignores stale events from the previous song',()=>{
 let time=10000,state=1,currentTime=0;const sent=[];
 const monitor=createPlaybackMonitor(message=>sent.push(message),()=>time);
 const player={getVideoData:()=>({video_id:'abcdefghijk'}),getDuration:()=>10,getPlayerState:()=>state,getCurrentTime:()=>currentTime};
 const song={key:'first',owner:'one',video:'abcdefghijk',start:1000};
 const check=(elapsed=9,id='one',s=song)=>monitor.check({song:s,id,player,elapsed});
 check();assert.equal(sent[0].type,'duration');check();assert.equal(sent.length,1);
 state=0;currentTime=10;check(10);assert.equal(sent.at(-1).type,'next');const count=sent.length;
 check(10);assert.equal(sent.length,count);time+=1600;check(12);assert.equal(sent.at(-1).key,'first');
 const next={...song,key:'second',duration:10};const before=sent.length;check(0,'one',next);assert.equal(sent.length,before,'same-video old ENDED must not skip a new song');
 check(999,'one',{...next,pausedAt:11000});assert.equal(sent.length,before,'paused playback cannot time out');
 check(10,'spectator',next);assert.equal(sent.length,before,'only the singer reports completion');
 state=1;check(13,'one',next);assert.equal(sent.at(-1).key,'second','elapsed fallback catches a missing ENDED event');
});

test('server deadlines advance the queue and return each previous singer to the left stairs',async t=>{
 const app=createApplication({ice:[]}),sockets=[];app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{for(const ws of sockets)ws.terminate();await app.close();});
 async function wait(client,predicate){const end=Date.now()+5000;while(Date.now()<end){const found=client.messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,5));}throw Error('Playback state missing');}
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=auto-next`),messages=[];sockets.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));const client={ws,messages};client.id=(await wait(client,m=>m.type==='hello')).id;return client;}
 const a=await connect(),b=await connect(),send=(client,message)=>client.ws.send(JSON.stringify(message));
 send(a,{type:'queue',video:'abcdefghijk',title:'First'});const first=(await wait(a,m=>m.type==='state'&&m.song?.owner===a.id)).song;
 send(b,{type:'queue',video:'lmnopqrstuv',title:'Second'});await wait(a,m=>m.type==='state'&&m.queue.length===1);
 send(b,{type:'duration',key:first.key,video:first.video,duration:.07});
 send(b,{type:'name',value:'Cannot shorten'});const unchanged=await wait(a,m=>m.type==='state'&&m.users.some(u=>u.name==='Cannot shorten'));assert.equal(unchanged.song.endAt,undefined);
 send(a,{type:'duration',key:first.key,video:first.video,duration:.07});
 send(a,{type:'playback',key:first.key,paused:true});await wait(a,m=>m.type==='state'&&Number.isFinite(m.song?.pausedAt));
 await new Promise(r=>setTimeout(r,1400));send(a,{type:'name',value:'Still paused'});
 const paused=await wait(a,m=>m.type==='state'&&m.users.some(u=>u.name==='Still paused'));
 assert.equal(paused.song.key,first.key,'deadline is canceled while paused');
 send(a,{type:'playback',key:first.key,paused:false});
 const second=await wait(b,m=>m.type==='state'&&m.song?.owner===b.id);
 const previous=second.users.find(u=>u.id===a.id);assert.equal(previous.x,-5.9);assert.equal(previous.z,-.95);assert.equal(previous.mic,false);
 assert.equal(second.users.find(u=>u.id===b.id).z,-4);
 send(a,{type:'next',key:first.key}); // a late retry cannot skip the next singer.
 send(b,{type:'duration',key:second.song.key,video:second.song.video,duration:.07});
 const done=await wait(b,m=>m.type==='state'&&!m.song&&m.users.find(u=>u.id===b.id)?.x===-5.9);
 assert.deepEqual(done.queue,[]);assert.equal(done.users.find(u=>u.id===b.id).z,-.95);
});
