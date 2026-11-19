import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createApplication} from '../server/application.mjs';
import {emptyRoom,joinMember,applyMessage,disconnectMember,expireMembers,snapshot,encodeRoom,decodeRoom} from '../server/room-state.mjs';

const join=(room,id,now=1000,extra={})=>joinMember(room,{id,connectionId:'socket-'+id,token:'token-'+id,...extra},now);
const command=(room,id,message,now=2000)=>applyMessage(room,id,'socket-'+id,message,now);
const transfer=(room,id,target,hostVersion=room.hostVersion)=>command(room,id,{type:'transfer-host',target,hostVersion,requestId:'host-request'});

test('the first arrival is host; room snapshots expose no resume secret',()=>{
 const room=emptyRoom();join(room,'a');join(room,'b');
 assert.equal(room.hostId,'a');assert.equal(room.hostVersion,1);
 const state=snapshot(room,1000);assert.equal(state.hostId,'a');assert.equal(state.hostReconnectUntil,null);
 assert.equal(state.users[1].connected,true);assert.ok(!JSON.stringify(state).includes('token-a'));
 const other=emptyRoom();join(other,'c');assert.equal(other.hostId,'c');
});

test('only the current host may transfer to another connected member, with a fresh version',()=>{
 const room=emptyRoom();join(room,'a');join(room,'b');join(room,'c');
 assert.equal(transfer(room,'b','c').controlResult.accepted,false);
 for(const target of ['a','missing',null])assert.equal(transfer(room,'a',target).controlResult.accepted,false);
 disconnectMember(room,'c','socket-c',1200);
 assert.equal(transfer(room,'a','c').controlResult.accepted,false);
 const old=room.hostVersion,result=transfer(room,'a','b');
 assert.equal(result.controlResult.accepted,true);assert.equal(result.snapshot.hostId,'b');assert.equal(result.events[0].message.hostId,'b');
 assert.equal(transfer(room,'a','c').controlResult.accepted,false);
 assert.equal(transfer(room,'b','a',old).controlResult.accepted,false);
 assert.equal(transfer(room,'b','a').controlResult.accepted,true);
 // Even if the original host regains ownership, its delayed command is stale.
 assert.equal(transfer(room,'a','b',old).controlResult.accepted,false);assert.equal(room.hostId,'a');
});

test('host resumes during 45-second grace; takeover from an old socket cannot remove ownership',()=>{
 const room=emptyRoom();join(room,'a');join(room,'b');
 disconnectMember(room,'a','socket-a',2000);
 assert.equal(snapshot(room,2000).hostReconnectUntil,47000);
 expireMembers(room,46999);assert.equal(room.hostId,'a');
 const resumed=join(room,'new-id',3000,{connectionId:'new-socket',resumeToken:'token-a'});
 assert.equal(resumed.id,'a');assert.equal(snapshot(room,3000).hostReconnectUntil,null);
 disconnectMember(room,'a','socket-a',4000);assert.equal(room.users.get('a').connectionId,'new-socket');assert.equal(room.hostId,'a');
});

test('expiry chooses the oldest connected member, skipping disconnected members',()=>{
 const room=emptyRoom();join(room,'a');join(room,'b');join(room,'c');join(room,'d');
 disconnectMember(room,'a','socket-a',2000);disconnectMember(room,'b','socket-b',2500);
 assert.equal(expireMembers(room,47000),true);assert.equal(room.hostId,'c');
 const restored=join(room,'new-a',48000,{resumeToken:'token-a'});assert.equal(restored.id,'new-a');assert.equal(room.hostId,'c');
 command(room,'c',{type:'leave'},49000);assert.equal(room.hostId,'d');
});

test('empty rooms clear ownership; legacy rooms and checkpoints preserve join order',()=>{
 let room=emptyRoom();join(room,'a');join(room,'b');
 room=decodeRoom(encodeRoom(room));assert.equal(room.hostId,'a');
 delete room.hostId;delete room.hostVersion;
 room=decodeRoom(encodeRoom(room));command(room,'b',{type:'heartbeat'});assert.equal(room.hostId,'a');
 disconnectMember(room,'a','socket-a',3000,0);assert.equal(room.hostId,'b');
 disconnectMember(room,'b','socket-b',3000,0);assert.equal(room.hostId,null);
 join(room,'c',4000);assert.equal(room.hostId,'c');
});

test('host transfer leaves the singer, queue, playback and microphone permissions intact',()=>{
 const room=emptyRoom();join(room,'a');join(room,'b');join(room,'c');
 command(room,'b',{type:'queue',video:'abcdefghijk'});command(room,'c',{type:'queue',video:'lmnopqrstuv'});
 const key=room.song.key,queue=JSON.stringify(room.queue);
 command(room,'b',{type:'playback',key,paused:false});
 transfer(room,'a','c');assert.equal(room.song.owner,'b');assert.equal(JSON.stringify(room.queue),queue);
 for(const type of ['next','playback'])assert.equal(command(room,'c',{type,key,paused:true}).controlResult.accepted,false);
 command(room,'c',{type:'mic',on:true});assert.equal(room.users.get('c').data.mic,false);
 assert.equal(command(room,'b',{type:'playback',key,paused:true}).controlResult.accepted,true);
 assert.equal(command(room,'b',{type:'next',key}).controlResult.accepted,true);assert.equal(room.song.owner,'c');
});

test('host handover is broadcast and grace expiration runs without waiting for a heartbeat',async t=>{
 const app=createApplication({ice:[],resumeGraceMs:70,heartbeatMs:20000}),sockets=[];
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{for(const socket of sockets)socket.terminate();await app.close();});
 async function wait(client,predicate){const until=Date.now()+3000;while(Date.now()<until){const i=client.messages.findIndex(predicate);if(i>=0)return client.messages.splice(i,1)[0];await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Host update missing');}
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=host-test`),client={ws,messages:[]};sockets.push(ws);ws.on('message',raw=>client.messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));client.hello=await wait(client,m=>m.type==='hello');return client;}
 const a=await connect(),b=await connect(),c=await connect();
 const state=await wait(c,m=>m.type==='state'&&m.users.length===3);assert.equal(state.hostId,a.hello.id);
 a.ws.send(JSON.stringify({type:'transfer-host',target:b.hello.id,hostVersion:state.hostVersion,requestId:'transfer-one'}));
 assert.equal((await wait(a,m=>m.type==='control-result'&&m.requestId==='transfer-one')).accepted,true);
 await wait(c,m=>m.type==='state'&&m.hostId===b.hello.id);
 b.ws.close();await once(b.ws,'close');
 await wait(c,m=>m.type==='state'&&m.hostId===b.hello.id&&Number.isFinite(m.hostReconnectUntil));
 await wait(c,m=>m.type==='state'&&m.hostId===a.hello.id);
});
