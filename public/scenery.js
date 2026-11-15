import * as T from 'three';
import {seats} from './layout.js';
import {addRecliners} from './recliner.js';
import {createGraffitiTexture} from './graffiti.js';

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
 for(const x of [-9.65,9.65])box(x,6.8,4,.23,1.4,26,'#ab9077');box(0,3.6,16.8,19.6,7.6,.22,'#443e58');
 const poster=new T.MeshBasicMaterial({map:createGraffitiTexture({width:1600,height:700,title:true,seed:31})}),hole=new T.MeshBasicMaterial({color:0,opacity:0,blending:T.NoBlending,side:T.FrontSide});
 function screen(x,y,z,w,h,rot){const group=new T.Group();group.position.set(x,y,z);group.rotation.y=rot;scene.add(group);box(0,0,-.1,w+.18,h+.18,.18,gold,group);const mesh=new T.Mesh(new T.PlaneGeometry(w,h),poster);mesh.position.z=.015;group.add(mesh);return {mesh,x,y,z,w,h,rot}}
 const rear=screen(0,3.88,-7.45,8.75,3.7,0),front=screen(1.72,1.85,-2.85,1.78,.67,Math.PI+.3);
 // Raise the singer's monitor above the stage lip; a slim stand meets its frame.
 box(1.72,1.22,-2.85,.08,.46,.08,gold);
 const chairs=addRecliners(scene,seats);
 // Painted end wall, facing the audience when they turn away from the stage.
 const paint=createGraffitiTexture({seed:71});
 const wallArt=new T.Mesh(new T.PlaneGeometry(18.9,5.9),new T.MeshBasicMaterial({map:paint}));wallArt.rotation.y=Math.PI;wallArt.position.set(0,3.2,16.65);scene.add(wallArt);
 // Graffiti panels along both side walls, below the acoustic timber slats.
 const sidePaint=[11,29,53].map(seed=>new T.MeshBasicMaterial({map:createGraffitiTexture({width:1200,height:500,seed})}));
 for(const sign of [-1,1])for(let i=0;i<6;i++){
  const panel=new T.Mesh(new T.PlaneGeometry(3.8,1.4),sidePaint[i%3]);panel.name='SideWallGraffiti';
  panel.rotation.y=-sign*Math.PI/2;panel.position.set(sign*9.48,.9,-5.2+i*4.1);scene.add(panel);
 }
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
 return {rear,front,poster,hole,spot,shaft,fixture,chairs};
}
