import test from 'node:test';
import assert from 'node:assert/strict';
import {movementKey,createMovementInput} from '../public/input.js';
import {createRenderBudget} from '../public/render-budget.js';

test('press and release between render frames still produces movement exactly once',()=>{
 let time=0;const input=createMovementInput(()=>time);
 time=2;input.press({code:'KeyW'});time=12;input.release({code:'KeyW'});
 time=16;assert.ok(Math.abs(input.sample().forward-.01)<1e-9);
 time=32;assert.equal(input.sample().forward,0);
 time=40;input.press({code:'KeyA'});time=50;input.release({code:'KeyA'});
 time=64;assert.ok(Math.abs(input.sample().right+.01)<1e-9);
});

test('held movement is independent of repeat events, normalized diagonally and stops on blur',()=>{
 let time=0;const input=createMovementInput(()=>time);
 input.press({code:'KeyW'});input.press({code:'KeyD'});input.press({code:'ShiftLeft'});
 time=20;const first=input.sample();assert.ok(Math.abs(Math.hypot(first.forward,first.right)-.04)<1e-9);
 time=40;const next=input.sample();assert.ok(Math.abs(next.forward-first.forward)<1e-9);
 input.clear();time=70;assert.equal(input.sample().forward,0);
});

test('slow frame rate lowers render resolution and sustained fast frames recover it',()=>{
 const budget=createRenderBudget();let ratio;
 for(let i=0;i<600;i++)ratio=budget.sample(40);assert.equal(ratio,.65);
 for(let i=0;i<800;i++)ratio=budget.sample(16);assert.equal(ratio,1);
 assert.equal(budget.sample(2000),1,'tab suspension is not GPU pressure');
});

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
