// Convert extracted world landmarks into the toy's fixed-length, independent joints.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from 'three';
const source=JSON.parse(await readFile(process.argv[2],'utf8'));
const indices=source.indices,up=new T.Vector3(0,1,0),front=new T.Vector3(0,0,-1);
const data=new Map(),times=[];
function direction(a,b){return a.clone().sub(b).normalize();}
function orientation(y){
 const z=front.clone().addScaledVector(y,-front.dot(y));
 if(z.lengthSq()<.001)z.set(0,1,0).addScaledVector(y,-y.y);
 z.normalize();const x=new T.Vector3().crossVectors(y,z).normalize();
 return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
}
// Symmetric five-frame smoothing removes single-camera landmark jitter.
for(let index=0;index<source.frames.length;index++){
 const frame=source.frames[index],p=new Map();
 for(let j=0;j<indices.length;j++){
  const value=new T.Vector3();let weight=0;
  for(let k=-2;k<=2;k++){const f=source.frames[Math.max(0,Math.min(source.frames.length-1,index+k))],w=3-Math.abs(k);value.addScaledVector(new T.Vector3(...f.p[j]),w);weight+=w;}
  p.set(indices[j],value.multiplyScalar(1/weight));
 }
 const hip=p.get(23).clone().add(p.get(24)).multiplyScalar(.5),shoulders=p.get(11).clone().add(p.get(12)).multiplyScalar(.5);
 const spine=direction(shoulders,hip),across=direction(p.get(23),p.get(24));
 const root=new T.Vector3(0,.88,0),poses=new Map();
 const put=(name,position,y)=>poses.set(name,{p:position,q:orientation(y)});
 put('hips',root,spine);put('torso',root.clone().addScaledVector(spine,.285),spine);
 put('head',root.clone().addScaledVector(spine,.79),spine);
 for(const [side,sign,s,e,w,h,k,a,heel,toe] of [['L',1,11,13,15,23,25,27,29,31],['R',-1,12,14,16,24,26,28,30,32]]){
  const shoulder=root.clone().addScaledVector(spine,.49).addScaledVector(across,sign*.395);
  const arm=direction(p.get(e),p.get(s)),lower=direction(p.get(w),p.get(e)),elbow=shoulder.clone().addScaledVector(arm,.24);
  put('upperArm'+side,shoulder.clone().addScaledVector(arm,.12),arm.clone().negate());
  put('forearm'+side,elbow.clone().addScaledVector(lower,.10),lower);
  const hipJoint=root.clone().addScaledVector(across,sign*.17),thigh=direction(p.get(k),p.get(h)),shin=direction(p.get(a),p.get(k));
  const knee=hipJoint.clone().addScaledVector(thigh,.38),ankle=knee.clone().addScaledVector(shin,.36);
  put('thigh'+side,hipJoint.clone().addScaledVector(thigh,.19),thigh.clone().negate());
  put('shin'+side,knee.clone().addScaledVector(shin,.18),shin.clone().negate());
  const foot=direction(p.get(toe),p.get(heel));foot.y=Math.max(-.4,Math.min(.4,foot.y));foot.normalize();
  put('foot'+side,ankle.clone().addScaledVector(foot,.04),foot);
 }
 const floor=Math.min(poses.get('footL').p.y,poses.get('footR').p.y)-.10;
 for(const [name,pose] of poses){
  pose.p.y-=floor;
  if(!data.has(name))data.set(name,{positions:[],quaternions:[]});
  const target=data.get(name);target.positions.push(...pose.p.toArray());target.quaternions.push(...pose.q.toArray());
 }
 times.push(frame.t);
}
const tracks=[];
for(const [name,{positions,quaternions}] of data){
 // Close the loop over the final .4s rather than snapping to the opening frame.
 for(let i=0;i<times.length;i++){
  const blend=Math.max(0,(times[i]-(times.at(-1)-.4))/.4);
  if(blend){
   const p=new T.Vector3().fromArray(positions,i*3).lerp(new T.Vector3().fromArray(positions),blend);
   const q=new T.Quaternion().fromArray(quaternions,i*4).slerp(new T.Quaternion().fromArray(quaternions),blend);
   p.toArray(positions,i*3);q.toArray(quaternions,i*4);
  }
 }
 tracks.push(new T.VectorKeyframeTrack(name+'.position',times,positions),new T.QuaternionKeyframeTrack(name+'.quaternion',times,quaternions));
}
const clip=new T.AnimationClip('parker',times.at(-1),tracks),json=T.AnimationClip.toJSON(clip);
await writeFile(process.argv[3],JSON.stringify({source:source.source,method:'Single-camera estimated pose, smoothed and retargeted to fixed toy limb lengths',clip:json},(_,value)=>typeof value==='number'?Math.round(value*1e6)/1e6:value));
console.log(`${times.length} poses, ${clip.duration.toFixed(2)}s, ${tracks.length} tracks`);
