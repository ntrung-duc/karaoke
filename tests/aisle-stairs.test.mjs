import test from 'node:test';
import assert from 'node:assert/strict';
import {aisles,aisleSteps,floorHeight,clearSeat,seats} from '../public/layout.js';

test('all three aisles have four short steps between each seating tier',()=>{
 assert.equal(aisleSteps.length,48);
 for(const aisle of aisles)for(let row=1;row<=4;row++){
  const steps=aisleSteps.filter(step=>step.x===aisle.x&&step.base===row-1);
  assert.equal(steps.length,4);
  let previous=row-1;
  for(const step of steps){assert.equal(step.y-previous,.25);assert.equal(floorHeight(step.z,aisle.x),step.y);assert.ok(clearSeat(aisle.x,step.z));previous=step.y;}
  assert.equal(floorHeight(row*2,aisle.x),row);
 }
});

test('steps do not alter chair platforms or upper landing height',()=>{
 for(const seat of seats)assert.equal(floorHeight(seat.z,seat.x),seat.y);
 for(const aisle of aisles){assert.equal(floorHeight(-1,aisle.x),0);assert.equal(floorHeight(12,aisle.x),4);}
 assert.equal(floorHeight(1.5,3.4),0);assert.equal(floorHeight(1.5,0),.5);
});
