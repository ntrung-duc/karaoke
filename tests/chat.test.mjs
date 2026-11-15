import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRoom,joinMember,applyMessage,snapshot,encodeRoom,decodeRoom} from '../server/room-state.mjs';

test('chat uses the room identity, deduplicates sends, limits flooding and bounds history',()=>{
 const room=emptyRoom();joinMember(room,{id:'one',connectionId:'socket',token:'token'},1000);
 applyMessage(room,'one','socket',{type:'name',value:'Tên thật'},1000);
 const send=(text,clientId,time=2000)=>applyMessage(room,'one','socket',{type:'chat',text,clientId,name:'Spoof'},time);
 for(const text of ['', '   ', 'a'.repeat(401),null])assert.deepEqual(send(text,'invalid-001').events,[]);
 const sent=send('  Xin chào <b>cả phòng</b>  ','message-001');const entry=sent.events[0].message.entry;
 assert.equal(entry.name,'Tên thật');assert.equal(entry.userId,'one');assert.equal(entry.text,'Xin chào <b>cả phòng</b>');
 assert.deepEqual(send('duplicate','message-001',2100).events,[]);
 assert.equal(send('too fast','message-002',2100).events[0].to,'one');
 for(let i=0;i<110;i++)send('Tin '+i,'history-'+String(i).padStart(3,'0'),3000+i*750);
 assert.equal(room.chat.length,100);assert.equal(room.chat.at(-1).text,'Tin 109');
 const restored=decodeRoom(encodeRoom(room));assert.equal(snapshot(restored,100000).chat.length,100);
 assert.equal(snapshot(emptyRoom(),100000).chat.length,0,'other rooms have separate history');
 const old=JSON.stringify({users:[],queue:[],song:null,revision:1});assert.deepEqual(decodeRoom(old).chat,[],'old deployed rooms migrate without losing state');
});
