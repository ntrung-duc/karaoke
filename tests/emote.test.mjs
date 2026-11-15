import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {emptyRoom,joinMember,applyMessage} from '../server/room-state.mjs';
import {createAvatar} from '../public/avatar.js';

test('only the current singer starts an emote; movement, jump and end of turn stop it',()=>{
 const room=emptyRoom();for(const id of ['one','two'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,message,time=3000)=>applyMessage(room,id,id,message,time);
 send('one',{type:'queue',video:'abcdefghijk'});const key=room.song.key,one=room.users.get('one').data;
 send('two',{type:'emote',key,on:true});assert.equal(room.users.get('two').data.emoteAt,0);
 send('one',{type:'emote',key:'old',on:true});assert.equal(one.emoteAt,0);
 send('one',{type:'emote',key,on:true});assert.equal(one.emoteAt,3000);
 send('one',{type:'move',x:one.x,z:one.z,yaw:1,pitch:0});assert.equal(one.emoteAt,3000,'looking around keeps the loop');
 send('one',{type:'emote',key,on:true},4000);assert.equal(one.emoteAt,3000,'duplicate starts keep the shared phase');
 send('one',{type:'move',x:.1,z:-4,yaw:0,pitch:0,gait:'walkRight'});assert.equal(one.emoteAt,0);
 send('one',{type:'emote',key,on:true});send('one',{type:'jump'});assert.equal(one.emoteAt,0);
 send('one',{type:'emote',key,on:true},5000);assert.equal(one.emoteAt,5000);
 send('one',{type:'emote',on:false},5100);assert.equal(one.emoteAt,0,'a blocked movement key can still stop the loop');
 send('one',{type:'emote',key,on:true},5200);send('one',{type:'next',key},5300);assert.equal(one.emoteAt,0);
});

test('wolf selection is validated, synchronized and stopped by movement, jump or turn end',()=>{
 const room=emptyRoom();for(const id of ['singer','listener'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,message,at=3000)=>applyMessage(room,id,id,message,at);
 send('singer',{type:'queue',video:'abcdefghijk'});const key=room.song.key,user=room.users.get('singer').data;
 send('listener',{type:'emote',key,on:true,emote:'wolf'});assert.equal(room.users.get('listener').data.emoteAt,0);
 send('singer',{type:'emote',key,on:true,emote:'invalid'});assert.equal(user.emoteAt,0);
 send('singer',{type:'emote',key,on:true,emote:'wolf'});assert.equal(user.emote,'wolf');assert.equal(user.emoteAt,3000);
 send('singer',{type:'emote',key,on:true,emote:'wolf'},3500);assert.equal(user.emoteAt,3000);
 send('singer',{type:'emote',key,on:true,emote:'parker'},4000);assert.equal(user.emoteAt,4000);assert.equal(user.emote,'parker');
 send('singer',{type:'emote',key,on:true,emote:'wolf'},4100);assert.equal(user.emoteAt,4100);
 send('singer',{type:'move',x:.2,z:-4,yaw:0,pitch:0,gait:'walkForward'},4200);assert.equal(user.emoteAt,0);
 send('singer',{type:'emote',key,on:true,emote:'wolf'},4300);send('singer',{type:'jump'},4400);assert.equal(user.emoteAt,0);
 send('singer',{type:'emote',key,on:true,emote:'wolf'},8000);assert.equal(user.emoteAt,8000);
 send('singer',{type:'next',key},8100);assert.equal(user.emoteAt,0);
});

test('wolf dance loops continuously on a shared timeline and restores the rig after turning',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../public'+path,import.meta.url),'utf8')),arrayBuffer:async()=>{const b=await readFile(new URL('../public'+path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 const avatar=createAvatar();t.after(()=>avatar.dispose());await avatar.ready;await avatar.prepareDance('wolf');
 const {duration}=JSON.parse(await readFile(new URL('../public/assets/wolf-dance.json',import.meta.url)));
 assert.ok(duration>8&&duration<8.3);
 const sample=time=>{avatar.update(.016,'wolf',0,0,true,time);avatar.body.updateMatrixWorld(true);return new T.Box3().setFromObject(avatar.body);};
 for(let i=0;i<250;i++){
  const box=sample(i/30);assert.ok(box.min.toArray().every(Number.isFinite)&&box.max.toArray().every(Number.isFinite));
  assert.ok(box.max.y<2.8&&box.max.x-box.min.x<2.8);assert.ok(Math.abs(box.min.y)<.05,'feet stay on stage');
 }
 sample(4.75);const arm=avatar.body.getObjectByName('Joint-armR'),position=arm.getWorldPosition(new T.Vector3()),quaternion=arm.getWorldQuaternion(new T.Quaternion());
 sample(4.75+duration*4);assert.ok(position.distanceTo(arm.getWorldPosition(new T.Vector3()))<1e-6);assert.ok(quaternion.angleTo(arm.getWorldQuaternion(new T.Quaternion()))<1e-6);
 const end=sample(duration-.0001),start=sample(0);assert.ok(end.min.distanceTo(start.min)<.001,'loop seam does not snap');
 avatar.update(.016,'idle',0,0,true);assert.equal(arm.parent.rotation.y,0,'normal movement clears the dance turn');
 avatar.update(.016,'walkForward',0,0,true);assert.equal(avatar.state,'walkForward');
});

test('extracted dance loops on a shared clock and restores normal motion',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../public'+path,import.meta.url),'utf8')),arrayBuffer:async()=>{const b=await readFile(new URL('../public'+path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 const avatar=createAvatar();t.after(()=>avatar.dispose());await avatar.ready;await avatar.prepareDance();
 const json=JSON.parse(await readFile(new URL('../public/assets/parker-dance.json',import.meta.url)));
 const duration=json.clip.duration;assert.ok(duration>10&&duration<11);
 let minY=Infinity;
 for(let i=0;i<200;i++){
  avatar.update(.016,'parker',0,0,true,i/20);avatar.body.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(avatar.body);
  assert.ok(box.min.toArray().every(Number.isFinite)&&box.max.toArray().every(Number.isFinite));
  assert.ok(box.max.y<2.8&&box.max.x-box.min.x<2.8,'retargeted proportions stay bounded');minY=Math.min(minY,box.min.y);
 }
 assert.ok(minY>-.15,'feet remain near the stage surface');
 avatar.update(0,'parker',0,0,true,1.25);avatar.body.updateMatrixWorld(true);const head=avatar.body.getObjectByName('head').getWorldPosition(new T.Vector3());
 avatar.update(.1,'parker',0,0,true,1.25+duration*10);avatar.body.updateMatrixWorld(true);assert.ok(head.distanceTo(avatar.body.getObjectByName('head').getWorldPosition(new T.Vector3()))<1e-6);
 avatar.update(.016,'walkForward',0,0,true);assert.equal(avatar.state,'walkForward');
});
