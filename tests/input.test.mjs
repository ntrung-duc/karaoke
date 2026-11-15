import test from 'node:test';
import assert from 'node:assert/strict';
import {movementKey,createMovementInput} from '../public/input.js';

test('physical WASD responds to the first press even during Vietnamese composition',()=>{
 for(const [code,key] of [['KeyW','w'],['KeyA','a'],['KeyS','s'],['KeyD','d']]){
  assert.equal(movementKey({code,key:'Process',isComposing:true,repeat:false}),key);
  assert.equal(movementKey({code,key:'ư',isComposing:true,repeat:false}),key);
  assert.equal(movementKey({code,key:key.toUpperCase(),shiftKey:true}),key);
 }
});

test('a brief press stops on release and delayed repeats cannot restart movement',()=>{
 const input=createMovementInput();
 input.press({code:'KeyA',key:'a',repeat:false});assert.ok(input.keys.has('a'));
 input.release({code:'KeyA',key:'a'});assert.equal(input.keys.size,0);
 assert.equal(input.press({code:'KeyA',key:'Process',repeat:true}),null);
 assert.equal(input.keys.size,0);
 input.press({code:'KeyA',key:'a',repeat:false});assert.ok(input.keys.has('a'));
 input.clear();assert.equal(input.keys.size,0);
});

test('an unidentified IME release clears latched movement while unrelated keyup does not',()=>{
 const input=createMovementInput();input.press({code:'KeyA',key:'Process'});
 input.release({code:'KeyB',key:'b'});assert.ok(input.keys.has('a'));
 input.release({code:'Unidentified',key:'Process'});assert.equal(input.keys.size,0);
 input.press({code:'KeyD',key:'d',ctrlKey:true});assert.equal(input.keys.size,0);
});

test('release uses the same physical key even when the composed character changes',()=>{
 const keys=new Set();keys.add(movementKey({code:'KeyW',key:'Process'}));
 keys.delete(movementKey({code:'KeyW',key:'ư'}));assert.equal(keys.size,0);
 assert.equal(movementKey({code:'ArrowLeft',key:'ArrowLeft'}),'arrowleft');
 assert.equal(movementKey({code:'ShiftRight',key:'Shift'}),'shift');
 assert.equal(movementKey({code:'KeyQ',key:'w'}),null);
 assert.equal(movementKey({key:'w'}),'w');
});
