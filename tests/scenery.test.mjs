import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createScenery,batchStaticBoxes} from '../public/scenery.js';

test('static hall batches retain bounds, audience screen and the stage microphone',t=>{
 const previous=globalThis.document;t.after(()=>{globalThis.document=previous;});
 globalThis.document={createElement(){return {width:1,height:1,getContext(){return new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>target[key]??(()=>{})});}};}};
 const scene=new T.Scene(),cube=new T.BoxGeometry(),materials=new Map();
 const material=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color}));return materials.get(color);};
 function box(x,y,z,w,h,d,color,parent=scene){const mesh=new T.Mesh(cube,material(color));mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=h>.2;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 const hall=createScenery(scene,box,material);
 scene.updateMatrixWorld(true);const before=new T.Box3().setFromObject(scene);
 const result=batchStaticBoxes(scene,cube),after=new T.Box3().setFromObject(scene);
 let drawObjects=0;scene.traverse(o=>{if(o.isMesh&&o.geometry===cube)drawObjects++;});
 console.log(`Static boxes: ${result.boxes} -> ${drawObjects} draw objects`);
 assert.ok(result.boxes>300);
 assert.ok(drawObjects<result.boxes*.1,'static boxes should need at least 90% fewer draw objects');
 assert.ok(before.min.distanceTo(after.min)<.0001&&before.max.distanceTo(after.max)<.0001);
 assert.equal(hall.front,undefined,'physical singer monitor is removed');
 assert.equal(hall.rear.mesh.parent.parent,scene);assert.equal(hall.microphone.name,'StageMicrophone');
 const frame=hall.rear.group.children.find(object=>object.geometry===cube);
 assert.ok(frame,'screen frame must remain attached after static batching');
 hall.setMode('movie');scene.updateMatrixWorld(true);
 for(const object of [hall.microphone,hall.spot,hall.shaft,hall.fixture])assert.equal(object.visible,false);
 assert.equal(hall.rear.w,12.4);assert.ok(Math.abs(hall.rear.w/hall.rear.h-16/9)<1e-9);
 const projected=new T.Box3().setFromObject(hall.rear.mesh),size=projected.getSize(new T.Vector3());
 assert.ok(Math.abs(size.x-hall.rear.w)<1e-5&&Math.abs(size.y-hall.rear.h)<1e-5,'physical screen matches the video projection');
 const frameSize=new T.Box3().setFromObject(frame).getSize(new T.Vector3());assert.ok(frameSize.x>size.x&&frameSize.y>size.y);
 assert.ok(projected.min.y>1&&projected.min.y<2,'cinema screen extends down into the former curtain area');
 hall.setMode('karaoke');scene.updateMatrixWorld(true);
 for(const object of [hall.microphone,hall.spot,hall.shaft,hall.fixture])assert.equal(object.visible,true);
 assert.equal(hall.rear.w,8.75);assert.equal(hall.rear.h,3.7);assert.equal(hall.rear.y,6);
 assert.equal(hall.rear.group.scale.x,1);assert.equal(hall.rear.group.scale.y,1);
});
