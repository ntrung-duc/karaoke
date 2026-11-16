import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {seats,clearSeat} from '../public/layout.js';
import {addRecliners} from '../public/recliner.js';
import {pathToSeat} from '../public/navigation.js';

test('40 upholstered recliners share geometry and retain walkable aisles',()=>{
 assert.equal(seats.length,40);assert.equal(new Set(seats.map(s=>`${s.x},${s.z}`)).size,40);
 const scene=new T.Scene(),parts=addRecliners(scene,seats);
 assert.ok(parts.length<24,'chairs use instancing rather than a mesh per cushion per chair');
 for(const part of parts){assert.equal(part.count,40);assert.ok(part.isInstancedMesh);assert.ok(part.boundingBox.max.y<4.5);}
 for(const s of seats)assert.ok(clearSeat(s.x,s.z-.83));
 for(const x of [-8,0,8])for(let z=-1;z<12;z+=.1)assert.ok(clearSeat(x,z));
});

test('click routes reach every chair through clear floor, including when starting at another chair',()=>{
 for(const from of [{x:0,z:12},{x:-6.4,z:.17},{x:6.4,z:8.17}])for(let index=0;index<seats.length;index++){
  const route=pathToSeat(from,index);assert.ok(route?.length);
  assert.ok(Math.hypot(route.at(-1).x-seats[index].x,route.at(-1).z-(seats[index].z-.83))<1e-6);
  let previous=from;
  for(const point of route){
   const steps=Math.ceil(Math.hypot(point.x-previous.x,point.z-previous.z)/.025);
   for(let i=1;i<=steps;i++)assert.ok(clearSeat(previous.x+(point.x-previous.x)*i/steps,previous.z+(point.z-previous.z)*i/steps),'route must avoid chair footprints');
   previous=point;
  }
 }
 assert.equal(pathToSeat({x:0,z:0},999),null);
});
