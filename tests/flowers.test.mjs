import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRoom,joinMember,applyMessage,encodeRoom,decodeRoom} from '../server/room-state.mjs';
import {seats,floorHeight} from '../public/layout.js';

function fixture(){
 const room=emptyRoom();
 for(const id of ['singer','viewer'])joinMember(room,{id,connectionId:id,token:id},1000);
 const send=(id,m,at=2000)=>applyMessage(room,id,id,m,at);
 send('singer',{type:'queue',video:'abcdefghijk'});
 return {room,send,key:room.song.key};
}
test('flowers use authoritative viewer and singer positions, multicast once and never enter room history',()=>{
 const {room,send,key}=fixture();Object.assign(room.users.get('viewer').data,{x:3,z:8,seat:2});
 const result=send('viewer',{type:'flower',key,from:{x:999},to:{x:999}});
 assert.equal(result.events.length,1);assert.equal(result.events[0].to,undefined);
 const event=result.events[0].message;assert.equal(event.type,'flower');assert.deepEqual(event.from,{x:3,y:1.45,z:8});
 assert.ok(event.to.x>=-6&&event.to.x<=6&&event.to.z>=-6.6&&event.to.z<=-3);
 assert.equal(event.to.y,1.08);assert.equal(room.chat.length,0);assert.ok(!encodeRoom(room).includes(event.id));
 assert.equal(send('viewer',{type:'flower',key},3000).events.length,0);
 const restored=decodeRoom(encodeRoom(room));
 assert.equal(applyMessage(restored,'viewer','viewer',{type:'flower',key},3199).events.length,0);
 assert.equal(send('viewer',{type:'flower',key},3200).events.length,1);
});
test('singers, stale turns, expired members and impersonated sessions cannot throw flowers',()=>{
 const {room,send,key}=fixture();
 assert.equal(send('singer',{type:'flower',key}).events.length,0);
 assert.equal(send('viewer',{type:'flower',key:'old'}).events.length,0);
 assert.equal(applyMessage(room,'viewer','wrong',{type:'flower',key},2000).expired,true);
 assert.equal(send('viewer',{type:'flower',key},100000).expired,true);
 room.song=null;assert.equal(send('singer',{type:'flower',key},2001).events.length,0);
});
test('flowers launch above elevated seats and the raised walking floor',()=>{
 const {room,send,key}=fixture(),viewer=room.users.get('viewer').data;
 Object.assign(viewer,{...seats[19],seat:19});
 assert.equal(send('viewer',{type:'flower',key}).events[0].message.from.y,seats[19].y+1.45);
 viewer.seat=-1;viewer.z=15;
 assert.equal(send('viewer',{type:'flower',key},4000).events[0].message.from.y,floorHeight(15)+1.2);
});
