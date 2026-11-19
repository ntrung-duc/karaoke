import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {TokenVerifier} from 'livekit-server-sdk';
import {emptyRoom,joinMember,applyMessage,disconnectMember,snapshot,encodeRoom,decodeRoom} from '../server/room-state.mjs';
import {createMovieCatalog,movieSlug} from '../server/movie-catalog.mjs';
import {moviePosition} from '../public/movie-state.js';
import {createApplication} from '../server/application.mjs';

const film={slug:'test-film',title:'Phim thử',episode:'1',server:'Vietsub',source:'https://cdn.example/film.m3u8'};
function fixture(){const room=emptyRoom();for(const id of ['a','b','c'])joinMember(room,{id,connectionId:id,token:id},1000);const send=(id,message,time=2000,extra)=>applyMessage(room,id,id,message,time,extra);const select=(id='a')=>send(id,{type:'movie-select',hostVersion:room.hostVersion},2000,{resolvedMovie:film});return {room,send,select};}

test('movie selection is authoritative, separate from queued karaoke, and starts paused',()=>{
 const {room,send,select}=fixture();assert.equal(select('b').controlResult.accepted,false);
 assert.equal(send('a',{type:'movie-select',hostVersion:room.hostVersion,source:'https://attacker'}).controlResult.accepted,false);
 select();assert.equal(room.mode,'movie');assert.equal(room.song,null);assert.equal(room.movie.paused,true);assert.equal(room.movie.source,film.source);
 send('b',{type:'queue',video:'abcdefghijk'});assert.equal(room.queue.length,1);assert.equal(room.song,null);
 send('a',{type:'room-mode',mode:'karaoke',hostVersion:room.hostVersion});assert.equal(room.mode,'karaoke');assert.equal(room.movie,null);assert.equal(room.movieVoiceKey,null);assert.equal(room.song.owner,'b');
});

test('selecting a film during karaoke waits for the current song and preserves the next singer',()=>{
 const {room,send,select}=fixture();send('b',{type:'queue',video:'abcdefghijk'});send('c',{type:'queue',video:'lmnopqrstuv'});
 const songKey=room.song.key;select();assert.equal(room.mode,'karaoke');assert.equal(room.pendingMode,'movie');assert.equal(room.song.key,songKey);
 send('b',{type:'finish',key:songKey});assert.equal(room.mode,'movie');assert.equal(room.movie.title,film.title);assert.equal(room.queue[0].owner,'c');assert.equal(room.users.get('b').data.mic,false);
 const restored=decodeRoom(encodeRoom(room));assert.equal(snapshot(restored,3000).movie.key,room.movie.key);
 send('a',{type:'room-mode',mode:'karaoke',hostVersion:room.hostVersion});assert.equal(room.song.owner,'c');
});

test('a pending mode change can be canceled without disrupting the current karaoke turn',()=>{
 const {room,send,select}=fixture();send('b',{type:'queue',video:'abcdefghijk'});select();const key=room.song.key;
 send('a',{type:'room-mode',mode:'karaoke',hostVersion:room.hostVersion});assert.equal(room.pendingMovie,null);assert.equal(room.pendingMode,null);assert.equal(room.song.key,key);
});

test('a slow catalog response cannot undo a more recent mode change',()=>{
 const {room,send}=fixture(),expectedMediaVersion=room.mediaVersion;
 send('a',{type:'room-mode',mode:'karaoke',hostVersion:room.hostVersion});
 const result=send('a',{type:'movie-select',hostVersion:room.hostVersion},2000,{resolvedMovie:film,expectedMediaVersion});
 assert.equal(result.controlResult.accepted,false);assert.equal(room.mode,'karaoke');assert.equal(room.movie,null);
});

test('only the host can play, pause and seek the current movie; stale commands cannot affect a new film',()=>{
 const {room,send,select}=fixture();select();const key=room.movie.key;
 const command={type:'movie-playback',key,paused:false,hostVersion:room.hostVersion};
 assert.equal(send('b',command).controlResult.accepted,false);
 assert.equal(send('a',command,3000).controlResult.accepted,true);assert.equal(moviePosition(room.movie,8000),5);
 send('a',{...command,paused:true},8000);assert.equal(moviePosition(room.movie,10000),5);
 send('a',{...command,position:120},10000);assert.equal(moviePosition(room.movie,12000),122);
 for(const position of [-1,Infinity,'20',90000])assert.equal(send('a',{...command,position}).controlResult.accepted,false);
 select();assert.equal(send('a',command).controlResult.accepted,false);
 send('a',{type:'transfer-host',target:'b',hostVersion:room.hostVersion});assert.equal(send('a',{...command,key:room.movie.key}).controlResult.accepted,false);
});

test('movie mic is opt-in for all viewers and cannot leak into karaoke voice sessions',()=>{
 const {room,send,select}=fixture();select();const voiceKey=room.movieVoiceKey;
 for(const id of ['a','b','c']){assert.equal(room.users.get(id).data.mic,false);send(id,{type:'mic',on:true});assert.equal(room.users.get(id).data.mic,true);assert.equal(send(id,{type:'voice-session',key:voiceKey}).voice.group,true);}
 send('a',{type:'room-mode',mode:'karaoke',hostVersion:room.hostVersion});
 for(const id of ['a','b','c']){assert.equal(room.users.get(id).data.mic,false);assert.equal(send(id,{type:'voice-session',key:voiceKey}).voice,null);}
});

test('a movie pauses at its current position when the last connected viewer leaves',()=>{
 const {room,send,select}=fixture();select();send('a',{type:'movie-playback',key:room.movie.key,paused:false,hostVersion:room.hostVersion},3000);
 for(const id of ['a','b'])disconnectMember(room,id,id,4000);
 assert.equal(room.movie.paused,false);
 disconnectMember(room,'c','c',6000);assert.equal(room.movie.paused,true);assert.equal(room.movie.position,3);assert.equal(moviePosition(room.movie,30000),3);
});

test('catalog validates links, requests only a fixed upstream and filters unsupported sources',async()=>{
 assert.equal(movieSlug('https://kkphim1.com/phim/test-film'),'test-film');assert.equal(movieSlug('https://www.kkphim2.com/phim/test-film/'),'test-film');
 for(const link of ['https://127.0.0.1/phim/test-film','https://evil.com/phim/test-film','../secrets','https://kkphim1.com/admin','https://kkphim1.com@evil.com/phim/a'])assert.equal(movieSlug(link),null);
 const urls=[];const catalog=createMovieCatalog({fetchImpl:async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('tim-kiem')?{data:{items:[{name:'Phim',slug:'test-film',thumb_url:'javascript:alert(1)'}]}}:{movie:{name:'Phim'},episodes:[{server_name:'Vietsub',server_data:[{name:'1',link_m3u8:film.source},{name:'2',link_m3u8:'javascript:alert(1)'}]}]}};}});
 const items=await catalog.search('phim');assert.equal(items[0].poster,null);
 const detail=await catalog.detail('https://kkphim1.com/phim/test-film');assert.equal(detail.episodes.length,1);
 await catalog.detail('test-film');assert.equal(urls.length,2,'details are cached');assert.ok(urls.every(url=>url.startsWith('https://phimapi.com/')));
});

test('websocket film selection distributes one timeline and group microphone tokens',async t=>{
 const movieCatalog={async search(){return [{slug:film.slug,title:film.title}];},async detail(){return {slug:film.slug,title:film.title,episodes:[{id:'0:0',name:'1',server:'Vietsub',source:film.source}]};}};
 const app=createApplication({ice:[],movieCatalog,livekitUrl:'wss://voice.example',livekitApiKey:'test-key',livekitApiSecret:'test-secret'}),sockets=[];
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{for(const ws of sockets)ws.terminate();await app.close();});
 async function wait(client,predicate){const end=Date.now()+3000;while(Date.now()<end){const i=client.messages.findIndex(predicate);if(i>=0)return client.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw new Error('Movie response missing');}
 async function join(){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=movie-test`),client={ws,messages:[]};sockets.push(ws);ws.on('message',raw=>client.messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));client.hello=await wait(client,m=>m.type==='hello');return client;}
 const a=await join(),b=await join();const state=await wait(b,m=>m.type==='state'&&m.users.length===2);
 const send=(client,message)=>client.ws.send(JSON.stringify(message));
 send(a,{type:'movie-select',slug:film.slug,episode:'0:0',hostVersion:state.hostVersion,requestId:'choose-film'});
 const accepted=await wait(a,m=>m.type==='control-result'&&m.requestId==='choose-film');assert.equal(accepted.accepted,true);
 const watching=await wait(b,m=>m.type==='state'&&m.mode==='movie');assert.equal(watching.movie.key,accepted.snapshot.movie.key);
 send(b,{type:'voice-session',key:watching.movieVoiceKey});const token=await wait(b,m=>m.type==='voice-session');
 const claims=await new TokenVerifier('test-key','test-secret').verify(token.token);assert.equal(claims.video.canPublish,true);assert.match(claims.video.room,/^movie-/);assert.deepEqual(claims.video.canPublishSources,['microphone']);
 send(a,{type:'movie-playback',key:watching.movie.key,paused:false,position:50,hostVersion:state.hostVersion,requestId:'play-film'});
 const playing=await wait(b,m=>m.type==='state'&&m.movie?.paused===false);assert.equal(playing.movie.position,50);
 const base=`http://127.0.0.1:${app.server.address().port}`;
 for(const path of ['/movies.js','/movie-player.js','/movie-state.js','/lib/hls.mjs','/lib/hls.worker.js']){const res=await fetch(base+path);assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/javascript/);await res.arrayBuffer();}
});
