import test from 'node:test';
import assert from 'node:assert/strict';
import {movementKey} from '../public/input.js';

test('physical WASD responds to the first press even during Vietnamese composition',()=>{
 for(const [code,key] of [['KeyW','w'],['KeyA','a'],['KeyS','s'],['KeyD','d']]){
  assert.equal(movementKey({code,key:'Process',isComposing:true,repeat:false}),key);
  assert.equal(movementKey({code,key:'ư',isComposing:true,repeat:false}),key);
  assert.equal(movementKey({code,key:key.toUpperCase(),shiftKey:true}),key);
 }
});

test('release uses the same physical key even when the composed character changes',()=>{
 const keys=new Set();keys.add(movementKey({code:'KeyW',key:'Process'}));
 keys.delete(movementKey({code:'KeyW',key:'ư'}));assert.equal(keys.size,0);
 assert.equal(movementKey({code:'ArrowLeft',key:'ArrowLeft'}),'arrowleft');
 assert.equal(movementKey({code:'ShiftRight',key:'Shift'}),'shift');
 assert.equal(movementKey({code:'KeyQ',key:'w'}),null);
 assert.equal(movementKey({key:'w'}),'w');
});
