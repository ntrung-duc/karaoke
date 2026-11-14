import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {createAvatar} from '../public/avatar.js';
import {SKINS} from '../public/avatar-settings.js';

test('smooth clothed toy keeps skin, shirt, pants and shoes independent across motion states',async t=>{
 const fetchBefore=globalThis.fetch;t.after(()=>globalThis.fetch=fetchBefore);
 globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/assets/human-motions.json',import.meta.url)))});
 const avatar=createAvatar(),other=createAvatar();await Promise.all([avatar.ready,other.ready]);
 t.after(()=>{avatar.dispose();other.dispose();});
 const shell=avatar.body.getObjectByName('ToyHeadShell'),torso=avatar.body.getObjectByName('ToyShirt-torso');
 assert.ok(shell);assert.ok(avatar.body.getObjectByName('ToyFace'));
 torso.geometry.computeBoundingBox();assert.ok(torso.geometry.boundingBox.max.z<.18,'shirt has no muscle relief');
 assert.equal(avatar.body.getObjectByName('ToyMuscles-torso'),undefined);
 avatar.setShirt('#ff4477');
 const pants=avatar.body.getObjectByName('ToyPants-thighL'),shoes=avatar.body.getObjectByName('ToyShoes-footL');
 const pantsColor=pants.material.color.getHexString(),shoesColor=shoes.material.color.getHexString();
 avatar.setSkin(5);
 avatar.body.traverse(o=>{if(o.name.startsWith('ToySkin-')||o.name==='ToyHeadShell')assert.equal(o.material.color.getHexString(),SKINS[5].color.slice(1));if(o.name.startsWith('ToyShirt-'))assert.equal(o.material.color.getHexString(),'ff4477');});
 assert.equal(pants.material.color.getHexString(),pantsColor);assert.equal(shoes.material.color.getHexString(),shoesColor);
 assert.notEqual(pantsColor,shoesColor);
 assert.notEqual(other.body.getObjectByName('ToyShirt-torso').material.color.getHexString(),'ff4477');
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
