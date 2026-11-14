import test from 'node:test';
import assert from 'node:assert/strict';
import {standLocally,reconcilePlayer} from '../public/player-state.js';

test('standing starts locally without waiting for the server and is applied only once',()=>{
 const user={seat:2,x:0,z:4,jumpAt:100};
 assert.equal(standLocally(user),true);assert.equal(user.seat,-1);assert.equal(user.z,3.17);
 assert.equal(standLocally(user),false);assert.equal(user.z,3.17);
});

test('room snapshots acknowledge standing without pulling a moving player backward',()=>{
 const local={seat:-1,x:1,z:3,yaw:1,pitch:.2,gait:'walkLeft',movingUntil:999,jumpAt:0};
 const stale={...local,seat:2,x:0,z:4,yaw:0,face:7};
 const pending=reconcilePlayer(local,stale,{pendingStand:true});
 assert.equal(pending.player.x,1);assert.equal(pending.player.z,3);assert.equal(pending.player.seat,-1);assert.equal(pending.player.face,7);
 assert.equal(pending.pendingStand,true);
 const acknowledged=reconcilePlayer(pending.player,{...stale,seat:-1},{pendingStand:true});
 assert.equal(acknowledged.pendingStand,false);assert.equal(acknowledged.player.z,3);assert.equal(acknowledged.player.yaw,1);
});

test('server seat/teleport still wins and an active predicted jump survives its stand acknowledgement',()=>{
 const local={seat:-1,x:2,z:3,yaw:1,pitch:0,gait:'idle',movingUntil:0,jumpAt:10000};
 const seated={...local,seat:1,x:-1.9,z:1,jumpAt:0};
 assert.deepEqual(reconcilePlayer(local,seated).player,seated);
 const teleported={...seated,seat:-1,z:-4,bodyYaw:Math.PI};
 assert.deepEqual(reconcilePlayer(local,teleported,{teleport:true,pendingStand:true}).player,teleported);
 assert.equal(reconcilePlayer(local,{...local,z:2.9,jumpAt:0},{now:10100}).player.jumpAt,10000);
 assert.equal(reconcilePlayer(local,{...local,z:2.9,jumpAt:9000},{now:10100}).player.jumpAt,10000);
});

test('delayed jump acknowledgements never restart or cancel a local jump',()=>{
 const local={seat:-1,x:2,z:3,yaw:1,pitch:0,gait:'walkForward',movingUntil:10240,jumpAt:10000};
 for(const jumpAt of [0,9900,10300]){
  const acknowledged=reconcilePlayer(local,{...local,x:1,jumpAt},{now:10400});
  assert.equal(acknowledged.player.jumpAt,10000);
  assert.equal(acknowledged.player.x,2);
 }
 const landed={...local,jumpAt:10000};
 assert.equal(reconcilePlayer(landed,{...landed,jumpAt:10300},{now:12000}).player.jumpAt,10000);
});
