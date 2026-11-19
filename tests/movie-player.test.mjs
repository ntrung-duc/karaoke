import test from 'node:test';
import assert from 'node:assert/strict';
import {createMoviePlayer} from '../public/movie-player.js';

function fixture(){
 const old=globalThis.document,videos=[],engines=[],errors=[],blocked=[];let clock=10000;
 globalThis.document={createElement(){const handlers=new Map(),video={readyState:1,currentTime:0,duration:100,paused:true,style:{},setAttribute(){},removeAttribute(){},canPlayType:()=>'',addEventListener(name,fn){handlers.set(name,fn);},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();},load(){},remove(){this.removed=true;},emit(name){handlers.get(name)?.();}};videos.push(video);return video;}};
 class Hls{static isSupported(){return true;}static Events={ERROR:'error'};static ErrorTypes={NETWORK_ERROR:'network',MEDIA_ERROR:'media'};constructor(){engines.push(this);}on(name,fn){this[name]=fn;}loadSource(src){this.src=src;}attachMedia(video){this.video=video;}destroy(){this.destroyed=true;}stopLoad(){this.stopped=true;}startLoad(){this.retried=true;}}
 const player=createMoviePlayer({getTarget:()=>({append(){}}),now:()=>clock,onBlocked:()=>blocked.push(true),onError:text=>errors.push(text),onDuration(){},onEnded(){},loadHls:async()=>({default:Hls})});
 return {player,videos,engines,errors,blocked,time(value){clock=value;},close(){player.close();globalThis.document=old;}};
}
const film={key:'one',source:'https://cdn.example/one.m3u8',position:20,updatedAt:10000,paused:true};
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('movie player follows pause/resume/seek and late join time without restarting HLS on each snapshot',async()=>{
 const f=fixture();try{
  f.player.update(film);await settle();const video=f.videos[0];video.emit('loadedmetadata');assert.equal(video.currentTime,20);assert.equal(video.paused,true);
  f.time(15000);f.player.update({...film,paused:false});assert.equal(video.currentTime,25);assert.equal(video.paused,false);
  f.player.update({...film,position:60,updatedAt:15000,paused:true});assert.equal(video.currentTime,60);assert.equal(video.paused,true);assert.equal(f.engines.length,1);
  f.player.unlock();assert.equal(video.paused,true,'unlock must not override shared pause');
  f.player.update(null);assert.equal(video.removed,true);assert.equal(f.engines[0].destroyed,true);
 }finally{f.close();}
});

test('switching film tears down the previous stream and bounds fatal source retries',async()=>{
 const f=fixture();try{
  f.player.update(film);await settle();const old=f.engines[0];
  f.player.update({...film,key:'two',source:'https://cdn.example/two.m3u8'});await settle();assert.equal(old.destroyed,true);assert.equal(f.engines.length,2);
  const current=f.engines[1];for(let i=0;i<3;i++)current.error(null,{fatal:true,type:'network'});
  assert.equal(current.stopped,true);assert.equal(f.errors.length,1);
  old.error(null,{fatal:true,type:'network'});assert.equal(f.errors.length,1,'old stream errors must not affect the new player');
 }finally{f.close();}
});

test('movie player adapter applies local film volume and mute without altering the shared timeline',async()=>{
 const f=fixture();try{
  f.player.adapter.setVolume(45);f.player.adapter.mute();f.player.update(film);await settle();const video=f.videos[0];assert.equal(video.volume,.45);assert.equal(video.muted,true);
  f.player.adapter.unMute();f.player.adapter.setVolume(0);assert.equal(video.muted,false);assert.equal(video.volume,0);assert.equal(film.position,20);assert.equal(film.paused,true);
 }finally{f.close();}
});
