import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {jumpPose,JUMP_HEIGHT,JUMP_DURATION,TAKEOFF,FLIGHT,movementGait,gaits} from '../public/motion.js';

test('jump has grounded takeoff, a single apex, landing and a bounded duration',()=>{
 const start=10000;
 assert.equal(jumpPose(0,start).state,null);
 assert.equal(jumpPose(start,start-1).state,null);
 assert.equal(jumpPose(start,start+100).state,'jump');
 assert.equal(jumpPose(start,start+100).height,0);
 assert.ok(Math.abs(jumpPose(start,start+(TAKEOFF+FLIGHT/2)*1000).height-JUMP_HEIGHT)<1e-9);
 assert.equal(jumpPose(start,start+(TAKEOFF+FLIGHT+.01)*1000).state,'land');
 assert.equal(jumpPose(start,start+(JUMP_DURATION+.01)*1000).state,null);
 for(let ms=0;ms<=2000;ms+=5){const {height}=jumpPose(start,start+ms);assert.ok(height>=0&&height<=JUMP_HEIGHT);}
});

test('all eight movement directions map to supplied motion clips',()=>{
 assert.equal(movementGait(0,0,false),'idle');
 for(const [f,r,suffix] of [[1,0,'Forward'],[1,1,'ForwardRight'],[0,1,'Right'],[-1,1,'BackwardRight'],[-1,0,'Backward'],[-1,-1,'BackwardLeft'],[0,-1,'Left'],[1,-1,'ForwardLeft']]){
  assert.equal(movementGait(f,r,false),'walk'+suffix);
  assert.equal(movementGait(f,r,true),'run'+suffix);
 }
});

test('all baked clips bind and animate the block avatar without invalid transforms',async()=>{
 const data=JSON.parse(await readFile(new URL('../public/assets/human-motions.json',import.meta.url)));
 const required=new Set([...gaits,'jump','fall','land']);
 assert.equal(data.clips.length,20);
 const rig=new T.Group();
 for(const [name,dimensions] of Object.entries(data.dimensions)){
  assert.ok(dimensions.every(v=>Number.isFinite(v)&&v>0));
  const node=new T.Object3D();node.name=name;rig.add(node);
 }
 const mixer=new T.AnimationMixer(rig);
 for(const raw of data.clips){
  const clip=T.AnimationClip.parse(raw);assert.ok(required.delete(clip.name));assert.ok(clip.validate());
  const action=mixer.clipAction(clip).play();
  for(let t=0;t<clip.duration;t+=.05){
   mixer.setTime(t);
   for(const node of rig.children){
    assert.ok(node.position.toArray().every(Number.isFinite));
    assert.ok(node.position.length()<3,'retarget stays at avatar scale');
    assert.ok(Math.abs(node.quaternion.length()-1)<.001);
   }
  }
  action.stop();
 }
 assert.equal(required.size,0);
});

test('runtime avatar loads clips, sits, stands, changes gait and plays jump states',async t=>{
 const originalFetch=globalThis.fetch;t.after(()=>globalThis.fetch=originalFetch);
 globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../public/assets/human-motions.json',import.meta.url)))});
 const {createAvatar}=await import('../public/block-avatar.js');
 const avatar=createAvatar('#1684bd',color=>new T.MeshStandardMaterial({color}));
 await avatar.ready;
 assert.equal(avatar.state,'idle');assert.equal(avatar.body.children[0].children.length,13);
 for(const state of ['sit','idle','walkBackwardLeft','runForwardRight','jump','fall','land','idle']){
  avatar.update(.016,state,.2,.1);assert.equal(avatar.state,state);
  avatar.body.traverse(o=>assert.ok(o.position.toArray().every(Number.isFinite)));
 }
 avatar.dispose();
 const removed=createAvatar('#1684bd',color=>new T.MeshStandardMaterial({color}));
 removed.dispose();await removed.ready;
 assert.equal(removed.body.children[0].children.length,0,'a departed user must not create meshes after loading');
 // A failed request must still leave a renderable avatar, including when seated.
 globalThis.fetch=async()=>{throw new Error('Expected offline test');};
 const offline=await import('../public/block-avatar.js?offline-test');
 const previousError=console.error;console.error=()=>{};
 try{
  const fallback=offline.createAvatar('#1684bd',color=>new T.MeshStandardMaterial({color}));
  await fallback.ready;assert.doesNotThrow(()=>fallback.update(.016,'sit',0,0));fallback.dispose();
 } finally {console.error=previousError;}
});
