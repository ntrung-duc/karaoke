import * as T from 'three';
import {seats} from './layout.js';
import {addRecliners} from './recliner.js';

// All architectural boxes are static. Batch them after construction, retaining
// their world transforms and shadow flags instead of drawing each box alone.
export function batchStaticBoxes(scene,geometry){
 scene.updateMatrixWorld(true);
 const groups=new Map(),meshes=[];
 scene.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh||object.geometry!==geometry)return;
  const key=object.material.uuid+':'+object.castShadow+':'+object.receiveShadow;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(object);meshes.push(object);
 });
 let batches=0;
 for(const objects of groups.values()){
  if(objects.length<2)continue;
  const batch=new T.InstancedMesh(geometry,objects[0].material,objects.length);
  batch.name='StaticHallBoxes';batch.castShadow=objects[0].castShadow;batch.receiveShadow=objects[0].receiveShadow;
  objects.forEach((object,index)=>batch.setMatrixAt(index,object.matrixWorld));
  batch.instanceMatrix.needsUpdate=true;
  batch.computeBoundingBox();batch.computeBoundingSphere();scene.add(batch);
  objects.forEach(object=>object.removeFromParent());batches++;
 }
 return {boxes:meshes.length,batches};
}

export function createScenery(scene,box,mat){
 const gold='#c39852',wood='#583a2f',dark='#32232a';
 box(0,-.14,4,20,.28,26,'#4b4862');box(0,4,-8,20,8,.3,dark);
 for(const x of [-9.65,9.65]){box(x,3,4,.23,6.3,26,'#b49779');box(x,1.65,4,.27,.07,26,gold);
 for(let z=-6;z<=13;z+=3){box(x*.99,2.9,z,.15,5.8,.11,wood);box(x*.98,3.25,z,.22,.62,.26,'#ffce87')}}
 box(0,.48,-5.25,14,.96,5.7,wood);box(0,.95,-5.25,14,.09,5.7,'#bc9875');box(0,.83,-2.38,14,.06,.05,gold);
 for(const x of [-5.9,5.9])for(let s=0;s<3;s++)box(x,.13*(3-s),-2.22+s*.28,1.8,.26*(3-s),.33,wood);
 for(const x of [-8,0,8]){const width=x===0?1.65:1.5;box(x,.011,5.5,width,.02,14.4,'#796557');for(const sign of [-1,1])box(x+sign*(width/2-.05),.029,5.5,.025,.012,14.4,gold)}
 for(const z of [-.85,11.1])box(0,.026,z,12.2,.024,1.05,'#796557');
 for(const sign of [-1,1]){
 for(let i=0;i<13;i++){const x=sign*(5.04+i*.175),depth=Math.cos(i*1.45)*.14;box(x,3.85,-7+depth,.2,5.8,.32,i%2?'#762138':'#aa3446')}
 box(sign*7,3.95,-7.2,.26,6.3,.55,gold)}
 box(0,6.93,-7.1,14.25,.14,.55,gold);
 for(const x of [-7.1,7.1])box(x,3.9,-6.8,.36,6.25,.65,'#392e2b');
 box(0,6.92,-6.8,14.55,.4,.65,'#392e2b');
 for(let i=0;i<60;i++)box(-7+i*.237,3.83,-7.78+.06*Math.sin(i*1.8),.245,5.74,.17,i%2?'#7a322a':'#944135');
 for(const x of [-9.45,9.45])for(let section=0;section<6;section++){
 const z=-5+section*4.15;box(x,4.1,z,.18,4.6,3.94,'#bea487');
 box(x*.99,1.79,z,.08,.055,3.91,'#ffe0a0');
 for(let j=0;j<12;j++)box(x*.986,4.6,z-1.74+j*.31,.13,3.45+.25*Math.cos(j*.5),.075,'#93795f');
 }
 for(let i=0;i<8;i++){const z=-7+i*3.3;box(0,7.45,z,19.6,.22,3.28,'#bb9d7f');box(0,7.29,z-1.55,19,.065,.084,'#fff0ce')}
 for(const x of [-9.65,9.65])box(x,6.8,4,.23,1.4,26,'#ab9077');box(0,3.6,16.8,19.6,7.6,.22,'#443e58'); function art(){
 const c=document.createElement('canvas');c.width=1200;c.height=500;const a=c.getContext('2d'),g=a.createLinearGradient(0,0,1200,500);g.addColorStop(0,'#32192b');g.addColorStop(.55,'#682d43');g.addColorStop(1,'#361e31');a.fillStyle=g;a.fillRect(0,0,1200,500);a.strokeStyle='#bc925d';a.lineWidth=3;a.strokeRect(20,20,1160,460);a.strokeRect(30,30,1140,440);
 for(let i=0;i<15;i++){a.beginPath();a.arc(600,720,345+i*14,Math.PI,Math.PI*2);a.strokeStyle='rgba(233,185,128,.15)';a.stroke()}
 a.textAlign='center';a.fillStyle='#f3d99f';a.font='italic 112px Georgia';a.fillText('Iron Dome',600,290);a.font='24px Georgia';a.fillText('K A R A O K E',600,362);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex}
 const poster=new T.MeshBasicMaterial({map:art()}),hole=new T.MeshBasicMaterial({color:0,opacity:0,blending:T.NoBlending,side:T.FrontSide});
 function screen(x,y,z,w,h,rot){const group=new T.Group();group.position.set(x,y,z);group.rotation.y=rot;scene.add(group);box(0,0,-.1,w+.18,h+.18,.18,gold,group);const mesh=new T.Mesh(new T.PlaneGeometry(w,h),poster);mesh.position.z=.015;group.add(mesh);return {mesh,x,y,z,w,h,rot}}
 const rear=screen(0,3.88,-7.45,8.75,3.7,0);
 // A microphone on a stand in front of the singer, visible to the audience.
 const microphone=new T.Group();microphone.name='StageMicrophone';microphone.position.set(0,1.02,-3.3);scene.add(microphone);
 function micPart(geometry,color,x,y,z){const mesh=new T.Mesh(geometry,mat(color));mesh.position.set(x,y,z);microphone.add(mesh);return mesh;}
 micPart(new T.CylinderGeometry(.27,.29,.045,24),'#25252c',0,.025,0);
 micPart(new T.CylinderGeometry(.018,.023,1.24,10),'#45454e',0,.66,0);
 const boom=new T.Vector3(0,.25,-.35),rod=micPart(new T.CylinderGeometry(.012,.012,boom.length(),8),'#45454e',0,1.355,-.175);
 rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),boom.normalize());
 const handle=micPart(new T.CylinderGeometry(.033,.029,.16,12),'#1f2026',0,1.48,-.39);handle.rotation.x=Math.PI/2;
 micPart(new T.SphereGeometry(.055,16,10),'#b2b4bd',0,1.48,-.50);
 const chairs=addRecliners(scene,seats);
 // One original mural on the rear wall only; the entrance overlays its quiet center.
 const wallMaterial=new T.MeshBasicMaterial({color:'#17151e'});
 if(typeof document.createElementNS==='function')new T.TextureLoader().load('/assets/rear-wall-mural.png',texture=>{
  texture.colorSpace=T.SRGBColorSpace;
  const ratio=(texture.image.width/texture.image.height)/(18.9/5.9);
  if(ratio<1){texture.repeat.y=ratio;texture.offset.y=(1-ratio)/2;}
  else{texture.repeat.x=1/ratio;texture.offset.x=(1-1/ratio)/2;}
  wallMaterial.map=texture;wallMaterial.color.set('#ffffff');wallMaterial.needsUpdate=true;
 });
 const wallArt=new T.Mesh(new T.PlaneGeometry(18.9,5.9),wallMaterial);wallArt.name='RearWallMural';wallArt.rotation.y=Math.PI;wallArt.position.set(0,3.2,16.65);scene.add(wallArt);
 box(0,2,16.48,3.65,4,.3,'#817b96');
 for(const side of [-1,1]){box(side*.78,1.81,16.24,1.53,3.58,.18,'#aaaabc');box(side*.78,1.82,16.14,.036,3.46,.03,'#67697a')}
 box(0,3.86,16.23,.96,.22,.15,'#252431');box(2.12,1.37,16.37,.27,.46,.13,'#a3a1ad');
 function glow(x,y,z,w,h,d,color){const block=box(x,y,z,w,h,d,color);block.material=new T.MeshBasicMaterial({color});block.castShadow=false;return block}
 glow(2.12,1.37,16.28,.095,.095,.04,'#a7a0bc');glow(0,3.87,16.12,.29,.034,.02,'#aca0bf');
 // Plastic studs on the stage lip evoke a brick-built game world.
 const studGeo=new T.CylinderGeometry(.084,.084,.055,12);
 const studs=new T.InstancedMesh(studGeo,mat('#a18273'),74);const matrix=new T.Matrix4();
 for(let i=0;i<74;i++)studs.setMatrixAt(i,matrix.makeTranslation(-6.48+(i%37)*.36,1.019,-2.62-Math.floor(i/37)*.32));scene.add(studs);
 scene.add(new T.HemisphereLight(0xb6c4ff,0x7a678a,.19));
 const spot=new T.SpotLight(0xffe1c2,270,22,.29,.68,1.65);
 spot.position.set(-2.4,6.95,.3);spot.target.position.set(0,1.35,-4.7);
 spot.castShadow=true;spot.shadow.bias=-.0003;spot.shadow.normalBias=.018;scene.add(spot,spot.target);
 const fixture=new T.Mesh(new T.CylinderGeometry(.19,.24,.56,12),mat('#33313c'));fixture.position.copy(spot.position);scene.add(fixture);
 const shaft=new T.Mesh(new T.ConeGeometry(1,1,36,1,true),new T.MeshBasicMaterial({color:0xffdaaf,transparent:true,opacity:.035,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));scene.add(shaft);
 return {rear,poster,hole,spot,shaft,fixture,chairs,microphone};
}
