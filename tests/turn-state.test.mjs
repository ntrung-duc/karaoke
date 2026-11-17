import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPlayback} from '../public/turn-state.js';

test('empty room and turn changes clear pending singer controls',()=>{
 assert.deepEqual(projectPlayback(null,null),{song:null,intent:null});
 const pending={key:'a',paused:false,song:{key:'a',start:100}};
 assert.deepEqual(projectPlayback(null,pending),{song:null,intent:null});
 const next={key:'b',pausedAt:200};assert.deepEqual(projectPlayback(next,pending),{song:next,intent:null});
});

test('stale room snapshots cannot undo a local start or pause before acknowledgement',()=>{
 const paused={key:'a',start:0,pausedAt:100},playing={key:'a',start:100};
 const start={key:'a',paused:false,song:playing};assert.equal(projectPlayback(paused,start).song,playing);assert.equal(projectPlayback(playing,start).intent,null);
 const stop={key:'a',paused:true,song:paused};assert.equal(projectPlayback(playing,stop).song,paused);assert.equal(projectPlayback(paused,stop).intent,null);
 assert.equal(projectPlayback(playing,null).song,playing);
});
