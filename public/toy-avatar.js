import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Smooth toy body with a separate garment material for each moving joint.
export function createToyPart(name,size,skin){
 const group=new T.Group(),pieces=[];
 function add(g,x=0,y=0,z=0,rz=0){g.rotateZ(rz);g.translate(x,y,z);pieces.push(g.index?g.toNonIndexed():g.clone());g.dispose();}
 function box(w,h,d,r,x=0,y=0,z=0){add(roundedBox(w,h,d,r),x,y,z);}
 const h=size[1];
 if(name==='head'){
  box(.43,.36,.36,.075);
  add(new T.CylinderGeometry(.082,.082,.066,20),0,.21,0);
  add(new T.CylinderGeometry(.085,.085,.095,20),0,-.205,0);
 }else if(name==='torso'){
  const shell=roundedBox(.61,h+.055,.34,.045),p=shell.attributes.position;
  for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)*(1+.13*p.getY(i)/(h/2)));
  shell.computeVertexNormals();add(shell);
 }else if(name==='hips'){
  box(.61,.125,.35,.012);box(.09,.16,.29,.012,0,-.075,0);
 }else if(name.startsWith('upperArm')){
  box(.23,h+.025,.27,.04);
 }else if(name.startsWith('forearm')){
  box(.19,h+.035,.23,.043);
  add(new T.CylinderGeometry(.063,.063,.07,12),0,h/2+.025,0);
  const ring=new T.Shape(),outer=.108,inner=.058,start=-Math.PI*.23,end=Math.PI*1.23;
  ring.absarc(0,0,outer,start,end,false);ring.lineTo(Math.cos(end)*inner,Math.sin(end)*inner);
  ring.absarc(0,0,inner,end,start,true);ring.closePath();
  const grip=new T.ExtrudeGeometry(ring,{depth:.085,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:2,steps:1,curveSegments:18});
  grip.translate(0,0,-.0425);grip.rotateZ(Math.PI);add(grip,0,h/2+.137,0);
 }else if(name.startsWith('thigh')){
  box(.268,h+.016,.31,.033);
 }else if(name.startsWith('shin')){
  box(.265,h+.01,.3,.018);
 }else if(name.startsWith('foot')){
  // Foot motion's local +Y points towards the toe.
  box(.276,h+.145,.145,.015,0,.022,0);
 }
 const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,skin);mesh.name=name==='head'?'ToyHeadShell':(name==='torso'||name.startsWith('upperArm')?'ToyShirt-':name==='hips'||name.startsWith('thigh')||name.startsWith('shin')?'ToyPants-':name.startsWith('foot')?'ToyShoes-':'ToySkin-')+name;
 mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 if(name==='head'){
  const face=new T.Mesh(new T.PlaneGeometry(.285,.275),new T.MeshBasicMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,alphaTest:.025}));
  face.position.set(0,-.006,.181);face.name='ToyFace';face.visible=false;group.add(face);
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
