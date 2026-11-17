import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRoomStore} from '../server/local-room-store.mjs';
import {emptyRoom,encodeRoom} from '../server/room-state.mjs';

test('live room commands continue while a checkpoint is blocked or fails',async()=>{
 let saveStarted,release,fail=true,saves=0;
 const entered=new Promise(resolve=>saveStarted=resolve),gate=new Promise(resolve=>release=resolve);
 const store=createLocalRoomStore({async ready(){},async loadRoom(){return null;},async saveRoom(){saves++;saveStarted();if(fail){await gate;throw new Error('offline');}},async close(){}},{intervalMs:5});
 const events=[];await store.subscribe('room',event=>events.push(event));
 await store.transact('room',room=>{room.chat.push({text:'one'});return {events:[{message:'one'}]};});
 await new Promise(resolve=>setTimeout(resolve,20));await entered;
 await store.transact('room',room=>{room.chat.push({text:'two'});return {events:[{message:'two'}]};});
 assert.deepEqual(events.map(event=>event.message),['one','two']);
 const count=await store.transact('room',room=>({count:room.chat.length}));assert.equal(count.count,2);
 release();fail=false;await store.close();assert.ok(saves>=1);
});

test('restoring a checkpoint keeps room and resume data but clears old socket ownership',async()=>{
 const room=emptyRoom();room.users.set('a',{connectionId:'old-process',expiresAt:Date.now()+60000,tokenDigest:'opaque',data:{id:'a',mic:true}});room.queue.push({key:'queued',owner:'a'});
 const store=createLocalRoomStore({async ready(){},async loadRoom(){return encodeRoom(room);},async saveRoom(){},async close(){}});
 const restored=await store.transact('room',state=>({member:state.users.get('a'),queue:state.queue}));
 assert.equal(restored.member.connectionId,null);assert.equal(restored.member.data.mic,false);assert.equal(restored.member.tokenDigest,'opaque');assert.equal(restored.queue[0].key,'queued');await store.close();
});
