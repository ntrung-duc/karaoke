import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraControls,MAX_DISTANCE,FIRST_PERSON_THRESHOLD} from '../public/camera-controls.js';
import {displacementGait} from '../public/motion.js';

function createOrbit(){const controls=createCameraControls();controls.setMode('avatar');return controls;}

test('new players start in first person and can scroll out to third person',()=>{
 const controls=createCameraControls(),head={yaw:.6,pitch:.1,bodyYaw:0};controls.sync(head);
 assert.equal(controls.mode,'first');assert.equal(controls.distance,0);assert.equal(controls.yaw,head.yaw);
 controls.zoom(120,head);assert.equal(controls.mode,'avatar');assert.ok(controls.distance>FIRST_PERSON_THRESHOLD);
 controls.zoom(-1000,head);assert.equal(controls.mode,'first');assert.equal(controls.distance,0);
});

test('first-person WASD uses the viewed direction instead of the old body direction',()=>{
 const controls=createOrbit(),head={yaw:0,pitch:0,bodyYaw:0};controls.sync(head);controls.setMode('first',head);
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  head.yaw=yaw;head.pitch=.9;
  const angle=controls.movementHeading(head);
  assert.equal(angle,yaw);
  const forward={x:-Math.sin(angle),z:-Math.cos(angle)},right={x:Math.cos(angle),z:-Math.sin(angle)};
  assert.ok(Math.abs(forward.x*(-Math.sin(yaw))+forward.z*(-Math.cos(yaw))-1)<1e-9);
  assert.ok(Math.abs(right.x*Math.cos(yaw)+right.z*(-Math.sin(yaw))-1)<1e-9);
 }
 controls.setMode('avatar',head);assert.equal(controls.movementHeading(head),controls.yaw);
});

test('third-person WASD follows the orbit immediately without turning the head or body',()=>{
 const controls=createOrbit(),head={yaw:0,pitch:0,bodyYaw:0};controls.sync(head);
 for(const yaw of [Math.PI/2,Math.PI,-Math.PI/2,0]){
  controls.turn(controls.yaw-yaw,0,head);
  assert.ok(Math.abs(controls.movementHeading(head)-yaw)<1e-9);
  assert.equal(head.yaw,0);assert.equal(head.bodyYaw,0);
 }
});

test('movement animation matches camera-relative travel around a fixed body',()=>{
 assert.equal(displacementGait(-1,0,0,false),'walkLeft');
 assert.equal(displacementGait(0,1,0,true),'runBackward');
 assert.equal(displacementGait(1,0,0,false),'walkRight');
 assert.equal(displacementGait(0,-1,Math.PI,false),'walkBackward');
});

test('third-person travel turns the body forward while the orbit stays independent',()=>{
 const controls=createOrbit(),head={yaw:0,pitch:0,bodyYaw:0};controls.sync(head);
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  controls.turn(controls.yaw-yaw,0,head);const cameraYaw=controls.yaw;
  for(const [dx,dz] of [[-Math.sin(yaw),-Math.cos(yaw)],[Math.cos(yaw),-Math.sin(yaw)],[Math.sin(yaw),Math.cos(yaw)]]){
   assert.equal(controls.faceMovement(head,dx,dz),true);
   assert.equal(displacementGait(dx,dz,head.bodyYaw,false),'walkForward');
   assert.equal(head.yaw,head.bodyYaw);assert.equal(controls.yaw,cameraYaw);
  }
 }
 const stopped={...head};assert.equal(controls.faceMovement(head,0,0),false);assert.deepEqual(head,stopped);
 controls.setMode('first',head);const first={...head};assert.equal(controls.faceMovement(head,1,0),false);assert.deepEqual(head,first);
});

test('orbit rotates the third-person camera without changing avatar head or body',()=>{
  const controls=createOrbit(),head={yaw:.2,pitch:.1,bodyYaw:0};controls.sync(head);
  const before={...head};
  for(let i=0;i<10;i++)assert.equal(controls.turn(.7,.02,head),false);
  assert.deepEqual(head,before);assert.notEqual(controls.yaw,head.yaw);
  controls.sync(head);assert.notEqual(controls.yaw,head.yaw,'room updates must not reset an orbit');
});

test('zooming into first person aligns the head, which then follows the camera',()=>{
  const controls=createOrbit(),head={yaw:0,pitch:0,bodyYaw:0};controls.sync(head);
  controls.turn(-1.2,-.2,head);
  assert.equal(head.yaw,0);
  assert.equal(controls.zoom(-1000,head),true);
  assert.equal(controls.mode,'first');assert.equal(controls.distance,0);
  assert.equal(head.yaw,controls.yaw);assert.equal(head.pitch,controls.pitch);
  assert.equal(controls.turn(.3,-.1,head),true);
  assert.equal(head.yaw,controls.yaw);assert.equal(head.pitch,controls.pitch);assert.equal(head.bodyYaw,0);
});

test('zooming out restores a local orbit and preserves the last head direction',()=>{
  const controls=createOrbit(),head={yaw:0,pitch:0};controls.sync(head);controls.zoom(-1000,head);
  controls.turn(-.8,.1,head);const before={...head};
  assert.equal(controls.zoom(120,head),false);assert.equal(controls.mode,'avatar');
  assert.ok(controls.distance>FIRST_PERSON_THRESHOLD);
  controls.turn(.9,.2,head);assert.deepEqual(head,before);
  controls.zoom(100000,head);assert.equal(controls.distance,MAX_DISTANCE);
});

test('camera button still cycles views and invalid wheel values leave the view intact',()=>{
  const controls=createOrbit(),head={yaw:Math.PI,pitch:0};controls.sync(head);
  controls.cycle(head);assert.equal(controls.mode,'first');
  controls.cycle(head);assert.equal(controls.mode,'overview');
  controls.zoom(-1000,head);assert.equal(controls.mode,'overview');
  controls.cycle(head);assert.equal(controls.mode,'avatar');
  const before=controls.distance;controls.zoom(NaN,head);controls.zoom(Infinity,head);assert.equal(controls.distance,before);
});
