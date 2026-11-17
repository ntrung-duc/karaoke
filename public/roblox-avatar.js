import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {faceTexture} from './faces.js';
import {faceIndex,skinColor,shirtColor} from './avatar-settings.js';
import {emoteName,isEmote} from './emotes.js';
import {loadWolfDance,applyWolfDance} from './wolf-dance.js';

let library,danceLibrary,faceGeometry;
export function loadMotions(){
 return library??=Promise.all([
  fetch('/assets/roblox-noob.glb').then(r=>{if(!r.ok)throw new Error('Không tải được avatar');return r.arrayBuffer();}).then(buffer=>new GLTFLoader().parseAsync(buffer,'')),
  fetch('/assets/human-motions.json').then(r=>{if(!r.ok)throw new Error('Không tải được chuyển động');return r.json();}).then(data=>data.clips.map(c=>T.AnimationClip.parse(c))),
 ]).then(([gltf,clips])=>({gltf,clips})).catch(error=>{library=null;throw error;});
}
function loadDance(){return danceLibrary??=fetch('/assets/parker-dance.json').then(r=>{if(!r.ok)throw new Error('Không tải được emote');return r.json();}).then(data=>T.AnimationClip.parse(data.clip)).catch(error=>{danceLibrary=null;throw error;});}

export function createAvatar(){
 const body=new T.Group(),rig=new T.Group(),head=new T.Group(),proxy=new T.Group(),nodes=new Map(),parts=new Map(),actions={};body.add(rig);
 const up=new T.Vector3(0,1,0),down=new T.Vector3(0,-1,0),direction=new T.Vector3(),lower=new T.Vector3(),torsoQ=new T.Quaternion(),lookQ=new T.Quaternion();
 let model,mixer,current,disposed=false,selectedFace=0,selectedSkin=0,selectedShirt=shirtColor(),decal,hipHeight=0,time=0,danceReady,wolfReady,wolf;
 const pivots={torso:[0,.7057,0],head:[0,1.4114,0],armL:[.5293,1.4114,0],armR:[-.5293,1.4114,0],legL:[.1764,.7057,0],legR:[-.1764,.7057,0]};
 const ready=loadMotions().then(({gltf,clips})=>{
  if(disposed)return;model=clone(gltf.scene);
  for(const [name,pivot] of Object.entries(pivots)){
   const mesh=model.getObjectByName(name),joint=name==='head'?head:new T.Group();joint.name=name==='head'?'head':'Joint-'+name;
   joint.position.fromArray(pivot);rig.add(joint);joint.add(mesh);mesh.position.fromArray(pivot).negate();mesh.material=mesh.material.clone();parts.set(name,joint);
   mesh.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    totalEmissiveRadiance += diffuseColor.rgb * (0.06 + 0.48 * max(0.0, dot(normal, normalize(vec3(-0.65, 0.85, 0.75)))));
   `);};mesh.material.customProgramCacheKey=()=> 'roblox-soft-fill-v1';
  }
  for(const clip of clips)for(const track of clip.tracks){const name=track.name.split('.')[0];if(!nodes.has(name)){const node=new T.Group();node.name=name;proxy.add(node);nodes.set(name,node);}}
  mixer=new T.AnimationMixer(proxy);for(const clip of clips)actions[clip.name]=mixer.clipAction(clip);
  setState('idle');mixer.update(0);hipHeight=nodes.get('hips').position.y;
  if(!faceGeometry){faceGeometry=new T.PlaneGeometry(.28,.28,12,10);const p=faceGeometry.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i);p.setXYZ(i,x,p.getY(i)+.185,-Math.sqrt(.2113**2-x*x)-.003);}faceGeometry.computeVertexNormals();}
  decal=new T.Mesh(faceGeometry,new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,alphaTest:.025,polygonOffset:true,polygonOffsetFactor:-2}));decal.name='AvatarFace';head.add(decal);
  applyColors();applyFace();update(0,'idle',0,0);
 });
 function applyColors(){for(const joint of parts.values())for(const mesh of joint.children){if(!mesh.isMesh||mesh===decal)continue;const name=mesh.material.name;
  if(name==='Suit')mesh.material.color.set(selectedShirt);else if(name==='Skin')mesh.material.color.set(skinColor(selectedSkin));
 }}
 function applyFace(){if(!decal)return;const index=selectedFace;faceTexture(index).then(texture=>{if(!disposed&&index===selectedFace){decal.material.map=texture;decal.material.needsUpdate=true;}}).catch(()=>{});}
 function setState(name,immediate=false){
  if(name===current)return;const next=actions[name]||actions.idle,old=actions[current]||(current==='wolf'?actions.idle:undefined);next.reset().setEffectiveWeight(1).play();
  if(old&&old!==next){if(immediate)old.stop();else next.crossFadeFrom(old,.12,false);}current=name;
 }
 function prepareDance(name='parker'){
  if(emoteName(name)==='wolf')return wolfReady??=Promise.all([ready,loadWolfDance()]).then(([,data])=>{if(!disposed)wolf=data;}).catch(error=>{wolfReady=null;throw error;});
  return danceReady??=Promise.all([ready,loadDance()]).then(([,clip])=>{if(!disposed)actions.parker=mixer.clipAction(clip);}).catch(error=>{danceReady=null;throw error;});
 }
 function update(dt,state,yaw=0,pitch=0,immediate=false,emoteElapsed=0,bow=0){
  if(disposed||!mixer)return;time+=Math.min(.1,Math.max(0,dt));
  const seated=state==='sit',jumping=['jump','fall','land'].includes(state);
  if(isEmote(state)&&(state==='wolf'?!wolf:!actions.parker)){prepareDance(state).catch(()=>{});state='idle';}
  setState(seated||jumping?'idle':state,immediate);
  if(state==='parker'){actions.parker.time=Math.max(0,emoteElapsed)%actions.parker.getClip().duration;mixer.update(0);}else if(state!=='idle')mixer.update(dt);
  rig.rotation.y=0;
  for(const [name,joint] of parts){joint.position.fromArray(pivots[name]);joint.quaternion.identity();}
  const torso=parts.get('torso');
  if(seated){
   torso.position.y=.88;head.position.y=1.5857;
   for(const side of ['L','R']){
    parts.get('arm'+side).position.y=1.5857;parts.get('arm'+side).rotation.x=1.1;
    parts.get('leg'+side).position.y=.88;parts.get('leg'+side).rotation.x=1.2;
   }
  }else if(jumping){
   for(const [side,sign] of [['L',1],['R',-1]])parts.get('arm'+side).rotation.x=Math.sin(time*7+sign)*.16;
  }else if(state==='idle'){
   // The model's neutral pivots give straight arms and legs with no idle sway.
  }else{
   if(state==='wolf')applyWolfDance(parts,rig,wolf,emoteElapsed);
   else{
   const lift=nodes.get('hips').position.y-hipHeight;
   torso.position.y+=lift;direction.subVectors(nodes.get('head').position,nodes.get('hips').position);torsoQ.setFromUnitVectors(up,direction.normalize());torso.quaternion.copy(torsoQ);
   head.position.set(0,.7057,0).applyQuaternion(torsoQ).add(torso.position);head.quaternion.copy(torsoQ);
   for(const [side,sign] of [['L',1],['R',-1]]){
    const arm=parts.get('arm'+side),leg=parts.get('leg'+side);
    arm.position.set(sign*.5293,.7057,0).applyQuaternion(torsoQ).add(torso.position);
    direction.subVectors(nodes.get('forearm'+side).position,nodes.get('upperArm'+side).position).normalize();arm.quaternion.setFromUnitVectors(down,direction);
    leg.position.y+=lift;direction.subVectors(nodes.get('foot'+side).position,nodes.get('thigh'+side).position).normalize();leg.quaternion.setFromUnitVectors(down,direction);
   }
   }
   // Ground the long rigid R6 legs using their actual animated geometry.
   body.updateMatrixWorld(true);let floor=Infinity;const point=new T.Vector3();
   for(const side of ['L','R']){const leg=parts.get('leg'+side);for(const x of [-.17,.17])for(const z of [-.17,.17]){point.set(x,-.7057,z);leg.localToWorld(point);body.worldToLocal(point);floor=Math.min(floor,point.y);}}
   for(const joint of parts.values())joint.position.y-=floor;
  }
  if(bow>0){const bend=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-.7*bow),pivot=new T.Vector3(0,.7057,0);for(const name of ['torso','head','armL','armR']){const joint=parts.get(name);joint.position.sub(pivot).applyQuaternion(bend).add(pivot);joint.quaternion.premultiply(bend);}}
  lookQ.setFromEuler(new T.Euler(-pitch,yaw,0,'YXZ'));head.quaternion.multiply(lookQ);
 }
 return {body,head,ready,prepareDance,update,get state(){return current;},
  setFace(value){const index=faceIndex(value);if(index!==selectedFace){selectedFace=index;applyFace();}},
  setSkin(value){if(value!==selectedSkin){selectedSkin=value;applyColors();}},setShirt(value){const color=shirtColor(value);if(color!==selectedShirt){selectedShirt=color;applyColors();}},
  dispose(){disposed=true;mixer?.stopAllAction();mixer?.uncacheRoot(proxy);for(const joint of parts.values())for(const mesh of joint.children)if(mesh.isMesh)mesh.material.dispose();},
 };
}
