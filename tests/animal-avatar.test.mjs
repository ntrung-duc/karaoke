import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAvatar} from '../public/avatar.js';
import {ANIMALS,animalId} from '../public/animal-settings.js';
import {emptyRoom,joinMember,applyMessage,snapshot} from '../server/room-state.mjs';

test('nine distinct lightweight animals keep their species sizes and share immutable geometry',()=>{
 assert.equal(ANIMALS.length,9);assert.equal(animalId('invalid'),'cat');
 for(const info of ANIMALS){
  const one=createAvatar(info.id),two=createAvatar(info.id);one.update(0,'idle');one.body.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(one.body);assert.ok(Math.abs(bounds.max.y-bounds.min.y-info.height)<.001,info.id+' height');assert.ok(Math.abs(bounds.min.y)<.001,info.id+' feet on floor');
  let meshCount=0,triangles=0;one.body.traverse(o=>{if(o.isMesh){meshCount++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  assert.ok(meshCount<22,info.id+' batches by color');assert.ok(triangles<25000,info.id+' geometry budget');
  assert.ok(one.eyeHeight>0&&one.eyeHeight<one.height);assert.notEqual(one.head,two.head);
  const original=one.head.quaternion.clone();one.update(.016,'idle',1,.2);assert.ok(one.head.quaternion.angleTo(original)>.1);assert.ok(two.head.quaternion.angleTo(original)<1e-8);
  one.dispose();two.update(0,'idle');assert.ok(new T.Box3().setFromObject(two.body).max.y>0);two.dispose();
 }
 assert.ok(ANIMALS.find(a=>a.id==='duck').height<ANIMALS.find(a=>a.id==='horse').height*.5);
 assert.ok(ANIMALS.find(a=>a.id==='chicken').height<ANIMALS.find(a=>a.id==='dragon').height*.5);
});

test('walking and jumping never animate animal limbs and seating rests on the cushion',()=>{
 const animal=createAvatar('dog');animal.update(0,'idle');animal.body.updateMatrixWorld(true);const before=new T.Box3().setFromObject(animal.body);
 for(const gait of ['walkForward','walkBackward','walkLeft','jump','fall','idle']){animal.update(.1,gait);animal.body.updateMatrixWorld(true);const after=new T.Box3().setFromObject(animal.body);assert.ok(after.min.distanceTo(before.min)<1e-8);assert.ok(after.max.distanceTo(before.max)<1e-8);}
 animal.update(.1,'sit');assert.ok(Math.abs(new T.Box3().setFromObject(animal.body).min.y-.79)<.001);animal.dispose();
});

test('animal selection is validated, locked after entry and preserved across resume',()=>{
 const room=emptyRoom();joinMember(room,{id:'one',connectionId:'s1',token:'secret'},1000);
 applyMessage(room,'one','s1',{type:'appearance',animal:'dragon'},1000);
 assert.equal(room.users.get('one').data.animal,'dragon');assert.equal(snapshot(room,1000).users[0].animalChosen,true);
 const rejected=applyMessage(room,'one','s1',{type:'appearance',animal:'duck'},1100);assert.equal(rejected.events[0].message.type,'error');assert.equal(room.users.get('one').data.animal,'dragon');
 joinMember(room,{id:'new',connectionId:'s2',token:'unused',resumeToken:'secret'},1200);
 assert.equal(room.users.size,1);applyMessage(room,'one','s2',{type:'appearance',animal:'pig'},1300);assert.equal(room.users.get('one').data.animal,'dragon');
 applyMessage(room,'one','s2',{type:'appearance',animal:'dragon'},1400);assert.equal(room.users.get('one').data.animal,'dragon');
 const fresh=emptyRoom();joinMember(fresh,{id:'two',connectionId:'s',token:'t'},1000);applyMessage(fresh,'two','s',{type:'appearance',animal:'wolf'},1100);assert.equal(snapshot(fresh,1100).users[0].animalChosen,false);
});
