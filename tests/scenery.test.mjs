import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createScenery,batchStaticBoxes} from '../public/scenery.js';

test('static hall batches cut draw objects while retaining bounds and the raised monitor',t=>{
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
 assert.equal(hall.front.y,1.85);assert.equal(hall.front.mesh.parent.parent,scene);
});
