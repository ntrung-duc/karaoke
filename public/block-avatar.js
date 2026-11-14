import * as T from 'three';
import {TAKEOFF,LANDING} from './motion.js';
import {faceIndex,skinColor} from './avatar-settings.js';
import {faceTexture} from './faces.js';
import {createToyPart} from './toy-avatar.js';

let library;
export function loadMotions() {
 return library ??= fetch('/assets/human-motions.json').then(r=>{
  if(!r.ok)throw new Error('Không tải được chuyển động avatar');
  return r.json();
 }).then(data=>({...data,clips:data.clips.map(clip=>T.AnimationClip.parse(clip))}));
}

export function createAvatar(color,material) {
 const body=new T.Group(),rig=new T.Group(),head=new T.Group(),nodes=new Map();
 const skin=new T.MeshStandardMaterial({color:skinColor(0),roughness:.43,emissive:skinColor(0),emissiveIntensity:.045});body.add(rig);
 // A camera-space soft fill keeps relief readable away from the stage light.
 // Apply it only to skin, without introducing a light per user or lighting the hall.
 skin.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   totalEmissiveRadiance += diffuseColor.rgb * (0.035 + 0.65 * max(0.0, dot(normal, normalize(vec3(-0.65, 0.85, 0.75)))));
  `);
 };
 skin.customProgramCacheKey=()=> 'toy-skin-fill-v1';
 const yAxis=new T.Vector3(),zAxis=new T.Vector3(),xAxis=new T.Vector3(),front=new T.Vector3(0,0,-1),basis=new T.Matrix4();
 let mixer,actions={},current=null,failed=false,disposed=false,selectedFace=-1,decal;
 function mesh(name,size) {
  const node=new T.Group();node.name=name;rig.add(node);nodes.set(name,node);
  const part=createToyPart(name,size,skin);node.add(part);
  if(name==='head'){
   // Baked head faces +Z locally, then turns with the source head motion.
   node.add(head);
   // Rotate the head shell and face together for independent look input.
   node.remove(part);head.add(part);
   decal=part.getObjectByName('ToyFace');applyFace();
  }
 }
 const ready=loadMotions().then(data=>{
  if(disposed)return;
  for(const [name,size] of Object.entries(data.dimensions))mesh(name,size);
  mixer=new T.AnimationMixer(rig);
  for(const clip of data.clips){
   const action=mixer.clipAction(clip);actions[clip.name]=action;
   if(['jump','land'].includes(clip.name)){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;}
  }
  actions.jump.setEffectiveTimeScale(actions.jump.getClip().duration/TAKEOFF);
  actions.land.setEffectiveTimeScale(actions.land.getClip().duration/LANDING);
  setState('idle');mixer.update(0);alignParts();
 }).catch(error=>{
  if(disposed)return;
  failed=true;console.error(error);
  // Keep a visible avatar if the motion request fails.
  const fallback={hips:[.49,.08,.31],torso:[.59,.5,.33],head:[.245,.43,.245]};
  for(const side of ['L','R'])Object.assign(fallback,{['upperArm'+side]:[.21,.22,.26],['forearm'+side]:[.19,.18,.24],['thigh'+side]:[.27,.38,.31],['shin'+side]:[.25,.36,.30],['foot'+side]:[.25,.16,.16]});
  for(const [name,size] of Object.entries(fallback))if(!nodes.has(name))mesh(name,size);
  nodes.get('torso').position.set(0,1,0);nodes.get('head').position.set(0,1.55,0);nodes.get('head').rotation.y=Math.PI;
  nodes.get('thighL').position.set(-.17,.36,0);nodes.get('thighR').position.set(.17,.36,0);
 });
 function setState(name){
  if(!mixer||name===current)return;
  if(name==='sit'){for(const action of Object.values(actions))action.stop();current=name;return;}
  const next=actions[name]||actions.idle,old=actions[current];
  next.reset().setEffectiveWeight(1).play();
  if(old)next.crossFadeFrom(old,.12,false);
  current=name;
 }
 function seated(){
  // The pack has no sit clip; use a seat pose tailored to the hall chairs.
  const placement={hips:[0,.88,0],torso:[0,1.08,0],head:[0,1.47,0]};
  for(const side of ['L','R']){
   const x=side==='L'?.17:-.17;
   placement['thigh'+side]=[x,.77,-.20];placement['shin'+side]=[x,.38,-.40];placement['foot'+side]=[x,.08,-.47];
   placement['upperArm'+side]=[x*2.25,1.07,-.05];placement['forearm'+side]=[x*2.25,.85,-.17];
  }
  for(const [name,p] of Object.entries(placement)){
   const node=nodes.get(name);if(!node)continue;node.position.fromArray(p);node.rotation.set(name.startsWith('thigh')?-Math.PI/2:name.startsWith('foot')?-Math.PI/2:0,Math.PI,0);
  }
 }
 function setFace(index){
  index=faceIndex(index);if(disposed||selectedFace===index)return;selectedFace=index;
  applyFace();
 }
 function applyFace(){
  if(!decal||selectedFace<0)return;
  const index=selectedFace;
  faceTexture(index).then(texture=>{
   if(disposed||selectedFace!==index)return;
   decal.material.map=texture;decal.material.needsUpdate=true;decal.visible=true;
  }).catch(error=>console.error(error));
 }
 function alignParts(){
  for(const [name,node] of nodes){
   node.userData.motionX=node.position.x;
   node.position.x*=name.includes('Arm')||name.startsWith('forearm')?1.75:1.42;
   if(name==='head')continue;
   yAxis.set(0,1,0).applyQuaternion(node.quaternion);
   zAxis.copy(front).addScaledVector(yAxis,-front.dot(yAxis));
   if(zAxis.lengthSq()<.0001)zAxis.set(0,1,0).addScaledVector(yAxis,-yAxis.y);
   zAxis.normalize();xAxis.crossVectors(yAxis,zAxis).normalize();
   basis.makeBasis(xAxis,yAxis,zAxis);node.quaternion.setFromRotationMatrix(basis);
  }
 }
 return {body,head,ready,setFace,setSkin(index){skin.color.set(skinColor(index));skin.emissive.copy(skin.color);},get state(){return current;},update(dt,state,yaw,pitch){
  if(disposed||!mixer&&!failed)return;
  for(const node of nodes.values())if(node.userData.motionX!==undefined)node.position.x=node.userData.motionX;
  setState(state);if(state==='sit')seated();else mixer?.update(dt);
  alignParts();
  head.rotation.set(-pitch,yaw,0,'YXZ');
 },dispose(){disposed=true;mixer?.stopAllAction();mixer?.uncacheRoot(rig);skin.dispose();decal?.material.dispose();body.traverse(o=>{if(o.isMesh)o.geometry.dispose()});}};
}
