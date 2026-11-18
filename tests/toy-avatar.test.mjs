import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {createAvatar,loadMotions} from '../public/roblox-avatar.js';
import {SKINS} from '../public/avatar-settings.js';

test('archived Roblox model has six independent rigid parts, old walk clips and configurable appearance',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../public'+path,import.meta.url),'utf8')),arrayBuffer:async()=>{const b=await readFile(new URL('../public'+path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
 const {gltf,clips}=await loadMotions(),bounds=new T.Box3().setFromObject(gltf.scene);
 assert.ok(Math.abs(bounds.max.y-bounds.min.y-1.8)<.001);
 let triangles=0;gltf.scene.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count;});assert.equal(triangles,3198,'all source triangles are retained');
 assert.ok(clips.some(c=>c.name==='walkForward'));
 const one=createAvatar(),two=createAvatar();await Promise.all([one.ready,two.ready]);t.after(()=>{one.dispose();two.dispose();});
 assert.notEqual(one.body.getObjectByName('Joint-armL'),two.body.getObjectByName('Joint-armL'));
 one.setShirt('#ff4477');one.setSkin(5);
 const colors={};one.body.traverse(o=>{if(o.isMesh)colors[o.material.name]=o.material.color.getHexString();});
 assert.equal(colors.Suit,'ff4477');assert.equal(colors.Skin,SKINS[5].color.slice(1));assert.equal(colors.Pants,'263449');
 assert.ok(one.body.getObjectByName('AvatarFace'));assert.equal(one.body.getObjectByName('AvatarBlackHelmet'),undefined);
 one.body.updateMatrixWorld(true);assert.ok(one.head.getWorldPosition(new T.Vector3()).y>1.3,'head stays above the torso');
 for(const state of ['idle','walkForward','walkBackward','walkRight','sit','jump','fall','land']){
  for(let i=0;i<20;i++){
   one.update(.016,state,0,0,true);one.body.updateMatrixWorld(true);const box=new T.Box3().setFromObject(one.body);
   assert.ok(box.min.toArray().every(Number.isFinite)&&box.max.toArray().every(Number.isFinite));
   assert.ok(box.max.x-box.min.x<3&&box.max.y<2.8,state+' stays bounded');
  }
 }
 one.update(.016,'jump',0,0,true);assert.equal(Math.abs(one.body.getObjectByName('Joint-legL').rotation.x),0,'no jump crouch or knee lift');
 one.update(.016,'fall',0,0,true);assert.equal(Math.abs(one.body.getObjectByName('Joint-legR').rotation.x),0);
 const torso=one.body.getObjectByName('Joint-torso');const before=torso.quaternion.clone();one.update(0,'fall',1.2,.2,true);assert.ok(torso.quaternion.angleTo(before)<1e-6,'look input only turns the head');
});
