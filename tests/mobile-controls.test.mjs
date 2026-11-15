import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickVector,createJoystick,createTouchCamera} from '../public/mobile-controls.js';
import {createMovementInput,createSeatGesture} from '../public/input.js';
import {createCameraControls} from '../public/camera-controls.js';

test('joystick has a dead zone, proportional speed and bounded diagonal movement',()=>{
 assert.equal(joystickVector(1,1).forward,0);assert.equal(joystickVector(0,0).right,0);
 assert.equal(joystickVector(0,-36).forward,1);assert.equal(joystickVector(36,0).right,1);
 const half=joystickVector(0,-18);assert.ok(half.forward>0&&half.forward<1);
 const diagonal=joystickVector(200,-200);assert.ok(Math.abs(Math.hypot(diagonal.forward,diagonal.right)-1)<1e-9);assert.ok(Math.hypot(diagonal.x,diagonal.y)<=36.0001);
 let time=0;const input=createMovementInput(()=>time);input.analog(.5,0);time=20;assert.equal(input.sample().forward,.01);
 input.analog(0,0);time=40;assert.equal(input.sample().forward,0);
 input.analog(1,1);input.press({code:'KeyW'});time=60;const step=input.sample();assert.ok(Math.hypot(step.forward,step.right)<=.0200001);
 input.clear();time=80;assert.equal(input.sample().right,0);
});

test('joystick captures one finger and stops on release, cancel, lost capture or reset',()=>{
 const span={style:{}},moves=[];let starts=0;
 const element={querySelector:()=>span,classList:{add(){},remove(){}},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
 const stick=createJoystick(element,{onStart:()=>{starts++;},onMove:(f,r)=>moves.push([f,r])});
 const event=(id,x=50,y=10)=>({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});
 for(const end of ['onpointerup','onpointercancel','onlostpointercapture']){
  element.onpointerdown(event(1));assert.equal(stick.active,true);assert.ok(moves.at(-1)[0]>0);
  element.onpointerdown(event(2));element[end](event(2));assert.equal(stick.active,true);
  element[end](event(1));assert.equal(stick.active,false);assert.deepEqual(moves.at(-1),[0,0]);
 }
 assert.equal(starts,3);element.onpointerdown(event(1));stick.reset();assert.deepEqual(moves.at(-1),[0,0]);
});

test('pinch zoom changes first/third person without a chair click or a remaining-finger camera jump',()=>{
 const touch=createTouchCamera(),camera=createCameraControls(),seat=createSeatGesture(),head={yaw:0,pitch:0};
 camera.sync(head);touch.begin(1,100,100);seat.begin(0,100,100);
 assert.deepEqual(touch.move(1,110,105),{kind:'turn',dx:10,dy:5});
 touch.begin(2,210,105);seat.cancel();const out=touch.move(2,170,105);assert.ok(out.delta>0);camera.zoom(out.delta,head);assert.equal(camera.mode,'avatar');
 const into=touch.move(2,350,105);assert.ok(into.delta<0);camera.zoom(into.delta,head);assert.equal(camera.mode,'first');
 touch.end(2);assert.equal(touch.move(1,130,120),null);assert.equal(seat.release(0,100,100),false);
 touch.end(1);touch.begin(3,5,5);assert.deepEqual(touch.move(3,10,15),{kind:'turn',dx:5,dy:10});touch.reset();assert.equal(touch.count,0);
});
