import {emptyRoom,joinMember,applyMessage} from '../server/room-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {TokenVerifier} from 'livekit-server-sdk';
import {createApplication} from '../server/application.mjs';
import {createLocalRoomStore} from '../server/local-room-store.mjs';

test('three users register, pause, finish, skip and resume without waiting for audience video',async t=>{
 const store=createLocalRoomStore({async ready(){},async loadRoom(){return null;},async saveRoom(){},async close(){}});
 const app=createApplication({store,livekitUrl:'wss://example.livekit.cloud',livekitApiKey:'test-api-key',livekitApiSecret:'test-secret-for-local-signing-only',ice:[]});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const sockets=[];
 t.after(async()=>{sockets.forEach(ws=>ws.terminate());await app.close();});
 async function wait(client,predicate){const deadline=Date.now()+3000;while(Date.now()<deadline){const index=client.messages.findIndex(predicate);if(index>=0)return client.messages.splice(index,1)[0];await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Room response missing');}
 async function join(resumeToken){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=flow`),client={ws,messages:[]};sockets.push(ws);ws.on('message',raw=>client.messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join',resumeToken}));client.hello=await wait(client,m=>m.type==='hello');return client;}
 const send=(client,message)=>client.ws.send(JSON.stringify(message));
 const [a,b,c]=await Promise.all([join(),join(),join()]);
 async function queue(client,requestId){send(client,{type:'queue',video:'abcdefghijk',title:requestId,requestId});const reply=await wait(client,m=>m.type==='queue-result'&&m.requestId===requestId);assert.equal(reply.accepted,true);return reply.key;}
 const first=await queue(a,'request-a'),second=await queue(b,'request-b'),third=await queue(c,'request-c');
 send(b,{type:'queue',video:'abcdefghijk',title:'retry',requestId:'request-b'});assert.equal((await wait(b,m=>m.type==='queue-result'&&m.requestId==='request-b')).key,second);
 const state=await wait(a,m=>m.type==='state'&&m.queue.length===2);assert.equal(state.song.key,first);assert.equal(state.song.phase,'ready');
 async function control(client,key,paused,requestId){send(client,{type:'playback',key,paused,requestId});return wait(client,m=>m.type==='control-result'&&m.requestId===requestId);}
 assert.equal((await control(b,first,false,'deny-b')).accepted,false);
 const started=await control(a,first,false,'start-a');assert.equal(started.accepted,true);assert.equal(started.snapshot.song.phase,'playing');
 assert.equal((await control(a,first,true,'pause-a')).snapshot.song.phase,'paused');
 assert.equal((await control(a,first,false,'resume-a')).snapshot.song.phase,'playing');
 send(a,{type:'finish',key:first});const next=await wait(b,m=>m.type==='state'&&m.song?.key===second);assert.equal(next.song.phase,'ready');assert.equal(next.users.find(u=>u.id===a.hello.id).x,-5.9);assert.equal(next.users.find(u=>u.id===b.hello.id).z,-4);
 // No video-prepared message from any participant is required.
 send(b,{type:'voice-session',key:second});const credentials=await wait(b,m=>m.type==='voice-session');
 const verifier=new TokenVerifier('test-api-key','test-secret-for-local-signing-only');const claims=await verifier.verify(credentials.token);assert.equal(claims.video.canPublish,true);assert.deepEqual(claims.video.canPublishSources,['microphone']);
 send(c,{type:'voice-session',key:second});const audience=await verifier.verify((await wait(c,m=>m.type==='voice-session')).token);assert.equal(audience.video.canPublish,false);assert.equal(audience.video.canSubscribe,true);assert.equal(audience.video.room,claims.video.room);
 b.ws.close();await once(b.ws,'close');const resumed=await join(b.hello.resumeToken);assert.equal(resumed.hello.id,b.hello.id);await wait(resumed,m=>m.type==='state'&&m.song?.key===second);
 send(resumed,{type:'next',key:second,requestId:'skip-b'});const skipped=await wait(resumed,m=>m.type==='control-result'&&m.requestId==='skip-b');assert.equal(skipped.accepted,true);assert.equal(skipped.snapshot.song.key,third);
 send(a,{type:'next',key:first,requestId:'stale-a'});assert.equal((await wait(a,m=>m.type==='control-result'&&m.requestId==='stale-a')).accepted,false);
});

 test('buffering progress extends the finish deadline without pausing other listeners',()=>{
 const room=emptyRoom();joinMember(room,{id:'a',connectionId:'sa',token:'ta'},1000);joinMember(room,{id:'b',connectionId:'sb',token:'tb'},1000);
 applyMessage(room,'a','sa',{type:'queue',video:'abcdefghijk'},1000);const key=room.song.key;
 applyMessage(room,'a','sa',{type:'playback',key,paused:false},2000);applyMessage(room,'a','sa',{type:'duration',key,video:'abcdefghijk',duration:100},2000);
 const deadline=room.song.endAt;
 const sample={type:'video-progress',key,start:room.song.start,position:10,state:3};
 applyMessage(room,'b','sb',sample,20000);assert.equal(room.song.endAt,deadline);
 const result=applyMessage(room,'a','sa',sample,20000);assert.ok(room.song.endAt>deadline);assert.equal(room.song.pausedAt,undefined);assert.deepEqual(result.events,[]);
 applyMessage(room,'a','sa',{type:'playback',key,paused:true},21000);applyMessage(room,'a','sa',sample,22000);assert.equal(room.song.endAt,undefined);
 });
