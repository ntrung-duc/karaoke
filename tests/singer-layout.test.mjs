import test from 'node:test';
import assert from 'node:assert/strict';
import {singerScreenRect} from '../public/singer-layout.js';

test('lyric screen is centered above chat and clear of singer controls and joystick',()=>{
 for(const [width,height,chatTop,controlsBottom,joystick] of [
  [1280,560,500,44,{left:12,right:116,top:394}],
  [780,360,307,42,{left:12,right:100,top:210}],
  [390,844,791,105,{left:12,right:116,top:678}],
  [320,250,197,42,{left:12,right:100,top:100}],
 ]){
  const r=singerScreenRect(width,height,{chatTop,controlsBottom,joystick});
  assert.ok(r.width>0&&r.height>0);assert.equal(r.x+r.width/2,width/2);
  assert.ok(r.y+r.height<=chatTop-12+.001);assert.ok(r.y>=controlsBottom+14-.001);
  assert.ok(r.x>=0&&r.x+r.width<=width);
  assert.ok(r.x>=joystick.right+12-.001||r.y+r.height<=joystick.top-12+.001,'screen avoids the joystick');
 }
 assert.ok(singerScreenRect(1280,560).width>=450,'landscape screen is larger than the old corner preview');
});

test('desktop lyric screen is enlarged at bottom left, clear of the chat',()=>{
 for(const [width,height] of [[1280,720],[1528,650],[1920,1080]]){
  const chatLeft=width/2-220,chatBottom=height-18;
  const r=singerScreenRect(width,height,{desktop:true,chatLeft,chatBottom});
  assert.equal(r.x,18);assert.equal(r.y+r.height,chatBottom);
  assert.ok(r.x+r.width<=chatLeft-18);assert.ok(r.width>=380&&r.width<=420);
 }
});
