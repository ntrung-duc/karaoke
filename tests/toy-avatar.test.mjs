import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {createAvatar} from '../public/avatar.js';
import {SKINS} from '../public/avatar-settings.js';

test('toy body has sculpted relief, independent head and consistent personal skin across motion states',async t=>{
 const fetchBefore=globalThis.fetch;t.after(()=>globalThis.fetch=fetchBefore);
 globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/assets/human-motions.json',import.meta.url)))});
 const avatar=createAvatar(),other=createAvatar();await Promise.all([avatar.ready,other.ready]);
 t.after(()=>{avatar.dispose();other.dispose();});
 const shell=avatar.body.getObjectByName('ToyHeadShell'),torso=avatar.body.getObjectByName('ToyMuscles-torso');
 assert.ok(shell);assert.ok(avatar.body.getObjectByName('ToyFace'));
 torso.geometry.computeBoundingBox();assert.ok(torso.geometry.boundingBox.max.z>.22,'muscles project out of the torso');
 avatar.setSkin(5);
 avatar.body.traverse(o=>{if(o.name.startsWith('ToyMuscles-')||o.name==='ToyHeadShell')assert.equal(o.material.color.getHexString(),SKINS[5].color.slice(1));});
 assert.equal(other.body.getObjectByName('ToyHeadShell').material.color.getHexString(),SKINS[0].color.slice(1));
 const rig=avatar.body.children[0];
 avatar.update(0,'idle',0,0);
 const rest=rig.children.map(n=>n.position.clone());
 for(let i=0;i<30;i++)avatar.update(0,'idle',i*.2,.1);
 rig.children.forEach((n,i)=>assert.ok(n.position.distanceTo(rest[i])<1e-6,'look input must not spread the body or change joint placement'));
 assert.equal(avatar.body.rotation.y,0);
 for(const state of ['sit','idle','walkForward','runBackwardRight','jump','fall','land']){
  avatar.update(.016,state,Math.PI,.2);avatar.body.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(avatar.body);
  assert.ok(bounds.min.toArray().every(Number.isFinite)&&bounds.max.toArray().every(Number.isFinite));
  assert.ok(bounds.max.x-bounds.min.x<2.5&&bounds.max.y<2.5,state+' keeps plausible proportions');
 }
});
