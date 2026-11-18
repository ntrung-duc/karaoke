import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roundedBox} from './toy-avatar.js';
import {animalId,animalInfo} from './animal-settings.js';

// Geometry and materials are cached by species, shared by every matching avatar.
const templates=new Map(),materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.85,emissive:color,emissiveIntensity:.22}));return materials.get(color);}
function bake(group){
 const buckets=new Map();group.updateMatrixWorld(true);
 for(const child of [...group.children]){const key=child.material.color.getHexString();if(!buckets.has(key))buckets.set(key,[]);const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrix);buckets.get(key).push(geometry);child.geometry.dispose();group.remove(child);}
 for(const [color,geometries] of buckets){const merged=mergeGeometries(geometries);geometries.forEach(geometry=>geometry.dispose());const mesh=new T.Mesh(merged,material('#'+color));mesh.name='AnimalSurface';group.add(mesh);}
}
function template(species){
 if(templates.has(species))return templates.get(species);
 const info=animalInfo(species),root=new T.Group(),body=new T.Group(),head=new T.Group(),wings=new T.Group();root.add(body,head,wings);
 const bird=species==='duck'||species==='chicken',cream='#fff0d4',black='#242025',pink='#ed9b9e',brown='#75452d',orange='#ed9635',base=info.color;
 const add=(parent,geometry,color,x,y,z,rx=0,ry=0,rz=0)=>{const mesh=new T.Mesh(geometry,material(color));mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);parent.add(mesh);return mesh;};
 const box=(parent,w,h,d,r,color,x,y,z,rx=0,ry=0,rz=0)=>add(parent,roundedBox(w,h,d,Math.min(r,w/2,h/2,d/2)),color,x,y,z,rx,ry,rz);
 const oval=(parent,w,h,d,color,x,y,z)=>{const geometry=new T.SphereGeometry(1,12,8);geometry.scale(w,h,d);return add(parent,geometry,color,x,y,z);};
 const cone=(parent,r,h,color,x,y,z,rx=0,rz=0)=>add(parent,new T.ConeGeometry(r,h,8),color,x,y,z,rx,0,rz);
 const tube=(parent,points,r,color)=>add(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),14,r,7,false),color,0,0,0);
 // Coordinates are a common unit silhouette, then scaled to each species height.
 if(bird){
  oval(body,.34,.31,.38,base,0,.43,.08);
  for(const sign of [-1,1]){box(body,.105,.22,.10,.025,orange,sign*.16,.17,.04);box(body,.25,.075,.29,.035,orange,sign*.16,.04,-.045);oval(body,.09,.18,.23,base,sign*.32,.44,.04);}
  cone(body,.16,.31,base,0,.53,.40,Math.PI/3);
 }else{
  box(body,.62,.48,.88,.16,base,0,.55,.13);
  for(const sign of [-1,1])for(const z of [-.17,.43]){
   box(body,.19,.36,.21,.055,base,sign*.22,.21,z);
   box(body,.20,.115,.22,.035,['cow','horse','pig'].includes(species)?(species==='pig'?brown:black):species==='bear'?base:cream,sign*.22,.06,z-.01);
  }
  oval(body,.245,.22,.035,['pig','bear'].includes(species)?base:cream,0,.55,-.315);
 }
 head.position.set(0,bird?.79:.96,-.21);
 box(head,.72,.63,.58,.16,base,0,0,0);
 for(const sign of [-1,1]){
  oval(head,.052,.075,.024,black,sign*.16,.065,-.291);
  oval(head,.014,.019,.008,'#ffffff',sign*.16-.012,.091,-.314);
 }
 if(species==='duck')box(head,.60,.13,.26,.05,orange,0,-.12,-.38);
 else if(species==='chicken'){
  cone(head,.115,.23,'#edba33',0,-.085,-.38,-Math.PI/2);
  for(let i=0;i<3;i++)oval(head,.07,.13,.07,'#d93837',(i-1)*.105,.35,0);
  for(const sign of [-1,1])oval(head,.075,.12,.06,'#d93837',sign*.065,-.32,-.25);
  for(let i=0;i<3;i++)oval(body,.075,.22,.085,cream,(i-1)*.10,.66,.42);
 }else{
  const snout=['cow','pig','horse','dragon'].includes(species);
  const muzzleColor=species==='pig'||species==='cow'?pink:species==='dragon'?base:cream;
  box(head,snout?.52:.42,snout?.25:.23,snout?.30:.12,.09,muzzleColor,0,-.15,snout?-.35:-.295);
  if(snout){for(const sign of [-1,1])oval(head,.028,.041,.012,species==='dragon'?'#306d37':brown,sign*.13,-.13,-.505);}
  else{
   oval(head,.065,.045,.035,species==='cat'?pink:black,0,-.10,-.37);
   for(const sign of [-1,1])tube(head,[[0,-.13,-.365],[sign*.045,-.195,-.365],[sign*.10,-.17,-.365]],.012,brown);
  }
 }
 for(const sign of [-1,1]){
  if(['cat','pig','horse'].includes(species)){
   cone(head,.15,.29,base,sign*.245,.385,.01,0,sign*-.16);
   cone(head,.086,.18,pink,sign*.245,.38,-.055,0,sign*-.16);
  }else if(species==='dog')box(head,.19,.48,.23,.085,'#ae713b',sign*.37,.02,.02,0,0,sign*.12);
  else if(species==='bear'){oval(head,.13,.14,.08,base,sign*.28,.30,0);oval(head,.077,.09,.025,'#ba8550',sign*.28,.30,-.065);}
  else if(species==='cow'){oval(head,.16,.085,.08,black,sign*.36,.21,.01);oval(head,.10,.05,.04,pink,sign*.37,.21,-.05);cone(head,.067,.24,cream,sign*.23,.40,.02,0,-sign*.20);}
  else if(species==='dragon'){cone(head,.085,.31,cream,sign*.25,.41,.04,0,-sign*.22);cone(head,.042,.10,cream,sign*.17,-.29,-.37,Math.PI);}
 }
 if(species==='cat'){
  for(const x of [-.13,0,.13])box(head,.043,.14,.018,.008,'#c27b2e',x,.235,-.289);
  for(const z of [0,.17,.34])box(body,.40,.018,.045,.008,'#c27b2e',0,.795,z);
 }
 if(species==='cow')for(const [x,y,z] of [[.30,.64,.25],[-.30,.52,.33],[.16,.79,.16]])oval(body,.022,.12,.14,black,x,y,z);
 if(species==='horse'){
  box(head,.085,.42,.02,.008,cream,0,.10,-.296);
  for(let i=0;i<4;i++)box(head,.45,.11,.15,.04,brown,0,.28-i*.13,.25);
  for(let i=0;i<3;i++)box(head,.16,.14,.29,.06,brown,(i-1)*.13,.29,-.08,0,0,-.3);
 }
 if(species==='pig')tube(body,[[0,.57,.55],[.10,.63,.65],[.05,.73,.70],[-.05,.70,.66],[0,.64,.64]],.035,base);
 else if(!bird){
  const tailColor=species==='horse'?brown:base;
  tube(body,[[0,.58,.53],[0,.65,.72],[0,.94,.83],[0,1.12,.72]],species==='dragon'?.10:species==='horse'?.09:.065,tailColor);
  if(['cat','dog'].includes(species))oval(body,.074,.085,.074,cream,0,1.12,.72);
 }
 if(species==='dragon'){
  box(body,.34,.39,.035,.08,'#e8c85b',0,.52,-.325);
  for(const sign of [-1,1]){
   const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(sign*.48,.37);shape.quadraticCurveTo(sign*.62,.11,sign*.47,-.08);shape.lineTo(sign*.30,-.01);shape.lineTo(0,-.20);shape.closePath();
   const hinge=new T.Group();hinge.name=sign===1?'AnimalWingL':'AnimalWingR';hinge.position.set(sign*.25,.72,.27);hinge.rotation.y=sign*.25;wings.add(hinge);
   add(hinge,new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false}),'#e6bf50',0,0,0);
   tube(hinge,[[0,0,.01],[sign*.48,.37,.01],[sign*.48,-.07,.01]],.025,base);
   bake(hinge);
  }
  for(let i=0;i<4;i++)cone(body,.07,.16,'#95c77c',0,.84,.02+i*.16);
 }
 bake(body);bake(head);
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),factor=info.height/(bounds.max.y-bounds.min.y);
 root.scale.setScalar(factor);root.position.y=-bounds.min.y*factor;
 const result={root,eyeHeight:(head.position.y+.065-bounds.min.y)*factor,head};templates.set(species,result);return result;
}
export function createAvatar(initial='cat'){
 const body=new T.Group();let model,head,selected,eye=0,compact=1,disposed=false;
 function setAnimal(value){const next=animalId(value);if(next===selected)return;selected=next;if(model)body.remove(model);const source=template(next);model=source.root.clone(true);head=model.children[1];body.add(model);eye=source.eyeHeight;body.userData.animal=next;}
 setAnimal(initial);body.name='AnimalAvatar';
 return {body,get head(){return head;},get eyeHeight(){return eye*compact;},get height(){return animalInfo(selected).height*compact;},ready:Promise.resolve(),setAnimal,
  update(dt,state,yaw=0,pitch=0){
   if(disposed)return;
   const seated=state==='sit',source=template(selected);
   // Compact sitting silhouettes stay below the chair back without changing
   // the full-size standing species or squashing head/body proportions.
   compact=seated?Math.min(1,.96/animalInfo(selected).height):1;
   model.scale.copy(source.root.scale).multiplyScalar(compact);
   model.position.y=source.root.position.y*compact+(seated?.79:0);
   for(const sign of [-1,1]){const wing=model.getObjectByName(sign===1?'AnimalWingL':'AnimalWingR');if(wing)wing.rotation.y=sign*(seated?-1.15:.25);}
   head.rotation.set(-Math.max(-.45,Math.min(.45,pitch)),yaw,0,'YXZ');
  },
  dispose(){disposed=true;body.remove(model);},get animal(){return selected;}};
}
export const loadMotions=()=>Promise.resolve();
