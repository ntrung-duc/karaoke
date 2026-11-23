import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {emptyRoom,joinMember,applyMessage,finishSong} from '../server/room-state.mjs';
import {songElapsed,createVideoSync} from '../public/playback.js';
import {moviePosition} from '../public/movie-state.js';
import {createApplication} from '../server/application.mjs';

function fixture(){
 const room=emptyRoom();for(const id of ['host','singer','guest'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,message,now=2000,extra)=>applyMessage(room,id,id,message,now,extra);
 send('singer',{type:'queue',video:'abcdefghijk'});const key=room.song.key;
 send('singer',{type:'duration',key,video:room.song.video,duration:120});
 return {room,key,send};
}
test('karaoke seek is singer-only, bounded, keeps paused/ready state and resumes at selected time',()=>{
 const {room,key,send}=fixture();
 for(const id of ['host','guest'])assert.equal(send(id,{type:'seek',key,position:15}).controlResult.accepted,false);
 for(const position of [-1,NaN,Infinity,'15',21601])assert.equal(send('singer',{type:'seek',key,position}).controlResult.accepted,false);
 assert.equal(send('singer',{type:'seek',key:'previous',position:15}).controlResult.accepted,false);
 assert.equal(send('singer',{type:'seek',key,position:15},3000).controlResult.accepted,true);
 assert.equal(songElapsed(room.song,9999),15);assert.equal(room.song.awaitingStart,true);assert.equal(room.song.endAt,undefined);assert.equal(room.song.seekVersion,1);
 send('singer',{type:'playback',key,paused:false},5000);assert.equal(songElapsed(room.song,5000),15);assert.equal(room.song.endAt,110000);
 send('singer',{type:'seek',key,position:50},6000);assert.equal(songElapsed(room.song,6000),50);assert.equal(songElapsed(room.song,7000),51);assert.equal(room.song.endAt,76000);
 finishSong(room,key,7000);assert.equal(room.song.key,key,'old/early deadlines do not end sought playback');
 send('singer',{type:'playback',key,paused:true},7000);send('singer',{type:'seek',key,position:500},8000);assert.equal(songElapsed(room.song,9000),120);assert.equal(room.song.endAt,undefined);
 send('singer',{type:'seek',key,position:0},9000);assert.equal(songElapsed(room.song,10000),0);assert.equal(Number.isFinite(room.song.pausedAt),true);
});
test('movie 15-second steps use server time, preserve pause, clamp bounds and require the current host',()=>{
 const {room,send}=fixture();send('singer',{type:'next',key:room.song.key});
 send('host',{type:'movie-select',hostVersion:room.hostVersion},3000,{resolvedMovie:{title:'Film',source:'https://cdn.example/a.m3u8',episode:'1',server:'test'}});
 const key=room.movie.key,cmd={type:'movie-playback',key,hostVersion:room.hostVersion,paused:true,delta:15};
 send('host',{type:'movie-duration',key,duration:100});
 assert.equal(send('guest',cmd).controlResult.accepted,false);
 for(const extra of [{delta:14},{delta:'15'},{position:10},{hostVersion:0},{key:'stale'}])assert.equal(send('host',{...cmd,...extra}).controlResult.accepted,false);
 send('host',cmd,4000);send('host',cmd,4001);assert.equal(moviePosition(room.movie,9999),30,'successive clicks add rather than replace the step');assert.equal(room.movie.paused,true);
 send('host',{...cmd,delta:-15},5000);assert.equal(moviePosition(room.movie,6000),15);
 send('host',{...cmd,paused:false},6000);assert.equal(moviePosition(room.movie,11000),35);
 send('host',{...cmd,paused:false,delta:15},11000);assert.equal(moviePosition(room.movie,11000),50);
 for(let i=0;i<10;i++)send('host',{...cmd,paused:false},12000+i);assert.equal(room.movie.position,100);
 for(let i=0;i<10;i++)send('host',{...cmd,delta:-15},13000+i);assert.equal(room.movie.position,0);assert.equal(room.movie.paused,true);
});
test('explicit karaoke seek updates singer/audience immediately once, preserving delay and paused playback',()=>{
 for(const id of ['singer','guest'])for(const paused of [false,true]){
  const calls=[];let current=10,state=paused?2:1;
  const player={getVideoData:()=>({video_id:'abcdefghijk'}),getPlayerState:()=>state,getCurrentTime:()=>current,cueVideoById(){},loadVideoById(){},seekTo(value){current=value;calls.push(['seek',value]);},playVideo(){state=1;calls.push(['play']);},pauseVideo(){state=2;calls.push(['pause']);}};
  const sync=createVideoSync(),song={key:'turn',owner:'singer',video:'abcdefghijk',start:0,...(paused?{pausedAt:10000}:{})};
  sync.sync({song,id,player,now:10000,delayMs:650});
  const sought={...song,start:-15000,seekVersion:1};
  sync.sync({song:sought,id,player,now:10000,delayMs:650});
  assert.equal(current,id==='guest'?24.35:25);assert.equal(state,paused?2:1);
  sync.sync({song:sought,id,player,now:10000,delayMs:650});assert.equal(calls.filter(c=>c[0]==='seek').length,1,'ordinary snapshots do not repeat explicit seeks');
 }
});
test('room sends acknowledged seeks to singer and audience without changing song or microphone session',async t=>{
 const app=createApplication({ice:[]}),clients=[];app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{for(const c of clients)c.ws.terminate();await app.close();});
 async function wait(c,p){const end=Date.now()+4000;while(Date.now()<end){const i=c.messages.findIndex(p);if(i>=0)return c.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw Error('Seek state missing');}
 async function join(){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=seek`),c={ws,messages:[]};clients.push(c);ws.on('message',raw=>c.messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));c.id=(await wait(c,m=>m.type==='hello')).id;return c;}
 const singer=await join(),guest=await join(),send=(c,m)=>c.ws.send(JSON.stringify(m));send(singer,{type:'queue',video:'abcdefghijk'});const first=(await wait(singer,m=>m.type==='state'&&m.song)).song;
 send(singer,{type:'seek',key:first.key,position:15,requestId:'seek-15'});const ack=await wait(singer,m=>m.type==='control-result'&&m.requestId==='seek-15');assert.equal(ack.accepted,true);assert.equal(songElapsed(ack.snapshot.song,ack.snapshot.now),15);
 const audience=await wait(guest,m=>m.type==='state'&&m.song?.seekVersion===1);assert.equal(audience.song.key,first.key);assert.equal(songElapsed(audience.song,audience.now),15);assert.equal(audience.song.awaitingStart,true);
 send(guest,{type:'seek',key:first.key,position:30,requestId:'forbidden'});assert.equal((await wait(guest,m=>m.requestId==='forbidden')).accepted,false);
});
