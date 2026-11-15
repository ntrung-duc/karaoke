import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Rounded cloth-doll silhouette, retargeted onto the existing motion joints.
export function createToyPart(name,size,material,helmet){
 const group=new T.Group(),pieces=[];
 function add(g,x=0,y=0,z=0){g.translate(x,y,z);pieces.push(g.index?g.toNonIndexed():g.clone());g.dispose();}
 function oval(x,y,z,px=0,py=0,pz=0){const g=new T.SphereGeometry(1,20,12);g.scale(x,y,z);add(g,px,py,pz);}
 function capsule(radius,length,depth=1){const g=new T.CapsuleGeometry(radius,Math.max(.001,length-radius*2),6,14);g.scale(1,1,depth);add(g);}
 const h=size[1];
 if(name==='head'){
  oval(.225,.26,.21);
  oval(.075,.10,.075,0,-.255,0);
 }else if(name==='torso'){
  // A continuous gently rounded torso, with a narrower neck and soft belly.
  const profile=[[-.27,0],[-.26,.18],[-.235,.28],[-.15,.295],[0,.275],[.14,.285],[.22,.25],[.265,.10],[.27,0]];
  const g=new T.LatheGeometry(profile.map(([y,r])=>new T.Vector2(r,y)),24);g.scale(1,1,.57);add(g);
 }else if(name==='hips'){
  oval(.29,.14,.165,0,-.005,0);
 }else if(name.startsWith('upperArm')){
  capsule(.115,h+.065,1.02);
 }else if(name.startsWith('forearm')){
  capsule(.092,h+.08,1.08);
  // Closed mitten hands replace the old C-shaped grips.
  oval(.098,.115,.095,0,h/2+.075,0);
 }else if(name.startsWith('thigh')){
  capsule(.134,h+.04,1.08);
 }else if(name.startsWith('shin')){
  const profile=[[-h/2-.025,0],[-h/2-.015,.055],[-h*.3,.086],[0,.106],[h*.3,.125],[h/2,.11],[h/2+.025,0]];
  const g=new T.LatheGeometry(profile.map(([y,r])=>new T.Vector2(r,y)),16);g.scale(1,1,1.1);add(g);
 }else if(name.startsWith('foot')){
  // Small rounded feet; local +Y still follows the animated toe direction.
  oval(.115,.13,.08,0,.015,0);
 }
 const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);mesh.name=name==='head'?'ToyHeadShell':(name==='torso'||name.startsWith('upperArm')?'ToyShirt-':name==='hips'||name.startsWith('thigh')||name.startsWith('shin')?'ToyPants-':name.startsWith('foot')?'ToyShoes-':'ToySkin-')+name;
 mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 if(name==='head'){
  const dome=new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2);dome.scale(.243,.24,.231);dome.translate(0,.15,0);
  const brim=new T.TorusGeometry(.229,.022,6,28);brim.rotateX(Math.PI/2);brim.scale(1.04,1,.99);brim.translate(0,.15,0);
  const hat=new T.Mesh(mergeGeometries([dome,brim]),helmet);dome.dispose();brim.dispose();hat.name='AvatarBlackHelmet';group.add(hat);
  // Curve the face decal over the oval head so its edges cannot float off it.
  const faceGeometry=new T.PlaneGeometry(.29,.28,12,10),p=faceGeometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)-.02;p.setXYZ(i,x,y,.21*Math.sqrt(Math.max(0,1-(x/.225)**2-(y/.26)**2))+.003);}
  faceGeometry.computeVertexNormals();
  const face=new T.Mesh(faceGeometry,new T.MeshBasicMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,alphaTest:.025}));
  face.name='ToyFace';face.visible=false;group.add(face);
 }
 return group;
}

export function roundedBox(w,h,d,r){
 const g=new T.BoxGeometry(w,h,d,6,6,6),p=g.attributes.position;
 const core=new T.Vector3(w/2-r,h/2-r,d/2-r),low=core.clone().negate(),v=new T.Vector3(),nearest=new T.Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);nearest.copy(v).clamp(low,core);
  v.sub(nearest).normalize().multiplyScalar(r).add(nearest);p.setXYZ(i,v.x,v.y,v.z);
 }
 g.computeVertexNormals();return g;
}
