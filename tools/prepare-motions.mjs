// Bake Kevin Iglesias' FBX motion onto the project's block avatar joints.
// Usage: node tools/prepare-motions.mjs [path-to-extracted-official-pack]
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {AnimationMixer, AnimationClip, VectorKeyframeTrack, QuaternionKeyframeTrack, Vector3, Quaternion, LoopOnce} from 'three';
import {motionSources as specifications} from './motion-sources.mjs';

const source = resolve(process.argv[2] || 'tools/source-assets/human-basic-motions-free');
const parts = [
 ['hips','hips','spine',.49,.31], ['torso','spine','neck',.59,.33],
 ...['L','R'].flatMap(side => [
  ['upperArm'+side,'upperArm'+side,'forearm'+side,.21,.26],
  ['forearm'+side,'forearm'+side,'hand'+side,.19,.24],
  ['thigh'+side,'thigh'+side,'shin'+side,.27,.31],
  ['shin'+side,'shin'+side,'foot'+side,.25,.30],
  ['foot'+side,'foot'+side,'toe'+side,.25,.16],
 ]),
 ['head','head',null,.245,.43],
];
async function load(path) {
 const bytes = await readFile(resolve(source,'Animations/Male',path+'.fbx'));
 return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '');
}
const idle = await load('Idles/HumanM@Idle01');
idle.updateMatrixWorld(true);
const headBind = idle.getObjectByName('B-head').getWorldQuaternion(new Quaternion()).invert();
const scale=.0092, up=new Vector3(0,1,0), clips=[], dimensions={};
for (const [name,path] of Object.entries(specifications)) {
 const rig = await load(path), clip=rig.animations[0];
 const mixer = new AnimationMixer(rig);
 const action=mixer.clipAction(clip); action.setLoop(LoopOnce,1); action.clampWhenFinished=true; action.play();
 const samples = parts.map(()=>({positions:[],rotations:[]}));
 const frames=Math.ceil(clip.duration*30), times=[];
 for (let frame=0;frame<=frames;frame++) {
  const time=frame*clip.duration/frames; times.push(time);
  mixer.setTime(time); rig.updateMatrixWorld(true);
  parts.forEach(([part,start,end,width,depth],index)=>{
   const bone=rig.getObjectByName('B-'+start), from=bone.getWorldPosition(new Vector3());
   let center=from.clone(), rotation;
   if(end) {
    const to=rig.getObjectByName('B-'+end).getWorldPosition(new Vector3());
    center.add(to).multiplyScalar(.5);
    rotation=new Quaternion().setFromUnitVectors(up,to.clone().sub(from).normalize());
    dimensions[part] ??= [width,from.distanceTo(to)*scale,depth];
   } else {
    rotation=bone.getWorldQuaternion(new Quaternion()).multiply(headBind);
    center.add(new Vector3(0,13,0).applyQuaternion(rotation));
    dimensions[part]=[width,depth,width];
   }
   // Source faces +Z; the avatar and camera controls face -Z.
   center.multiplyScalar(scale).applyAxisAngle(up,Math.PI);
   rotation.premultiply(new Quaternion().setFromAxisAngle(up,Math.PI));
   samples[index].positions.push(...center.toArray());
   samples[index].rotations.push(...rotation.toArray());
  });
 }
 const tracks=parts.flatMap(([part],i)=>[
  new VectorKeyframeTrack(part+'.position',times,samples[i].positions),
  new QuaternionKeyframeTrack(part+'.quaternion',times,samples[i].rotations),
 ]);
 clips.push(AnimationClip.toJSON(new AnimationClip(name,clip.duration,tracks).optimize()));
 mixer.uncacheRoot(rig);
}
const rounded=JSON.stringify({source:'Human Basic Motions FREE 2.4.2 — Kevin Iglesias',dimensions,clips},(_,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v);
await mkdir('public/assets',{recursive:true});
await writeFile('public/assets/human-motions.json',rounded);
console.log(`Baked ${clips.length} clips, ${(rounded.length/1024).toFixed(0)} KiB`);
