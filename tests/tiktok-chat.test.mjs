import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {WebSocket} from 'ws';
import {createTikTokChat,tiktokUsername} from '../server/tiktok-chat.mjs';
import {createApplication} from '../server/application.mjs';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await pause(5);}throw new Error('TikTok event missing');}
class FakeLive extends EventEmitter{
 connect(){return Promise.resolve();}
 disconnect(){this.closed=true;this.emit('disconnected');return Promise.resolve();}
}
function fixture(t,options={}){
 const events=[],sources=[];
 const bridge=createTikTokChat({emit:(key,message)=>events.push({key,...message}),connector:async()=>{const client=new FakeLive();sources.push(client);return {client};},batchMs:5,retryMs:5,timeoutMs:50,...options});
 t.after(()=>bridge.close());return {bridge,events,sources};
}
test('TikTok accepts usernames and canonical LIVE URLs only, not arbitrary upstreams',()=>{
 for(const name of ['@Some.Name','Some.Name','https://www.tiktok.com/@Some.Name/live?lang=vi'])assert.equal(tiktokUsername(name),'some.name');
 for(const name of ['',null,'https://evil.test/@user/live','https://www.tiktok.com.evil.test/@user/live','http://tiktok.com/@user/live','https://user:pass@tiktok.com/@user/live','https://tiktok.com:8080/@user/live','https://vt.tiktok.com/abc','a b','a'.repeat(25)])assert.equal(tiktokUsername(name),null);
});
test('TikTok has one source per room, bounded sanitized comments, deduplication and room isolation',async t=>{
 const {bridge,events,sources}=fixture(t,{now:()=>1000});bridge.start('a','@creator');bridge.start('a','creator');bridge.start('b','another');
 await until(()=>bridge.status('a').state==='connected'&&bridge.status('b').state==='connected');assert.equal(sources.length,2);
 const client=sources[0];for(let i=0;i<100;i++)client.emit('chat',{common:{msgId:String(i)},comment:'<script>hello</script>'+'.'.repeat(500),user:{nickname:'N'.repeat(100)}});
 await until(()=>events.some(m=>m.type==='tiktok-chat'));const batch=events.find(m=>m.type==='tiktok-chat');assert.equal(batch.key,'a');assert.equal(batch.entries.length,5);assert.equal(batch.entries[0].text.length,400);assert.equal(batch.entries[0].name.length,80);assert.equal(batch.entries[0].source,'tiktok');assert.match(batch.entries[0].text,/<script>/,'HTML remains plain text for the renderer');
 client.emit('chat',{common:{msgId:'0'},comment:'duplicate'});await pause(15);assert.equal(events.filter(m=>m.type==='tiktok-chat').length,1);
 bridge.stop('a');assert.equal(client.closed,true);assert.equal(bridge.status('a').state,'disconnected');assert.equal(bridge.status('b').state,'connected');client.emit('chat',{comment:'late'});await pause(10);assert.equal(events.filter(m=>m.type==='tiktok-chat').length,1);
});
test('TikTok stream end stops retries, switching cannot publish stale results',async t=>{
 let resolveOld;const old=new FakeLive();old.connect=()=>new Promise(resolve=>resolveOld=resolve);
 const events=[],next=new FakeLive(),bridge=createTikTokChat({emit:(_,m)=>events.push(m),connector:async name=>({client:name==='old'?old:next}),timeoutMs:200});t.after(()=>bridge.close());
 bridge.start('room','old');await until(()=>resolveOld);bridge.start('room','next');await until(()=>bridge.status('room').state==='connected');resolveOld();await pause(10);assert.equal(bridge.status('room').username,'next');assert.equal(old.closed,true);
 next.emit('streamEnd');assert.equal(bridge.status('room').state,'ended');await pause(20);assert.equal(bridge.status('room').state,'ended');assert.equal(next.closed,true);
});
test('TikTok retries are bounded and recover after a fresh manual request',async t=>{
 let calls=0;const {bridge}=fixture(t,{connector:async()=>{calls++;throw new Error('upstream refused secret details');}});bridge.start('room','creator');await until(()=>bridge.status('room').state==='error');assert.equal(calls,3);assert.ok(!bridge.status('room').message.includes('secret'));
 bridge.start('room','creator');await until(()=>calls===6);await until(()=>bridge.status('room').state==='error');
});
test('TikTok timeout cancels hanging attempts, empty-room cleanup cancels retries and capacity is bounded',async t=>{
 const sources=[];const {bridge}=fixture(t,{maxRooms:1,timeoutMs:10,connector:async()=>{const client=new FakeLive();client.connect=()=>new Promise(()=>{});sources.push(client);return {client};}});
 bridge.start('room','creator');assert.ok(bridge.start('other','second').error);await until(()=>bridge.status('room').state==='error');assert.equal(sources.length,3);assert.ok(sources.every(c=>c.closed));bridge.stop('room');await pause(30);assert.equal(sources.length,3);assert.equal(bridge.status('room').state,'disconnected');assert.deepEqual(bridge.start('other','second'),{});
});
test('real room sockets authorize TikTok controls, broadcast separately and survive upstream failure',async t=>{
 let source,calls=0;const app=createApplication({ice:[],tiktokConnector:async()=>{calls++;source=new FakeLive();return {client:source};}}),clients=[];
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{for(const c of clients)c.ws.terminate();await app.close();});
 async function wait(c,predicate){let found;await until(()=>{const i=c.messages.findIndex(predicate);if(i<0)return false;found=c.messages.splice(i,1)[0];return true;});return found;}
 async function join(room){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=${room}`),c={ws,messages:[]};clients.push(c);ws.on('message',raw=>c.messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join'}));c.hello=await wait(c,m=>m.type==='hello');return c;}
 const host=await join('live'),guest=await join('live'),other=await join('separate');const send=(c,m)=>c.ws.send(JSON.stringify(m));
 send(guest,{type:'tiktok-connect',username:'creator',hostVersion:1,requestId:'unauthorized'});assert.match((await wait(guest,m=>m.requestId==='unauthorized')).error,/Chỉ chủ phòng/);assert.equal(calls,0);
 send(host,{type:'tiktok-connect',username:'creator',hostVersion:0,requestId:'stale-host'});assert.match((await wait(host,m=>m.requestId==='stale-host')).error,/Chỉ chủ phòng/);assert.equal(calls,0);
 // Use a new host socket (resume) to avoid waiting out the command throttle.
 const token=host.hello.resumeToken;host.ws.close();await once(host.ws,'close');
 const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=live`),resumed={ws,messages:[]};clients.push(resumed);ws.on('message',raw=>resumed.messages.push(JSON.parse(raw)));await once(ws,'open');send(resumed,{type:'join',resumeToken:token});const hello=await wait(resumed,m=>m.type==='hello');assert.equal(hello.id,host.hello.id);
 send(resumed,{type:'tiktok-connect',username:'creator',hostVersion:1,requestId:'connect'});assert.equal((await wait(resumed,m=>m.requestId==='connect')).error,undefined);await wait(guest,m=>m.type==='tiktok-status'&&m.state==='connected');assert.equal(calls,1);
 source.emit('chat',{common:{msgId:'first'},user:{nickname:'TikTok friend'},comment:'Hello'});const received=await wait(guest,m=>m.type==='tiktok-chat');assert.equal(received.entries[0].text,'Hello');assert.ok(!other.messages.some(m=>m.type==='tiktok-chat'));
 const late=await join('live');assert.equal((await wait(late,m=>m.type==='tiktok-status')).state,'connected');assert.equal(calls,1);
 source.emit('disconnected');await wait(guest,m=>m.type==='tiktok-status'&&m.state==='reconnecting');send(guest,{type:'chat',clientId:'normal-chat-1',text:'still works'});assert.equal((await wait(resumed,m=>m.type==='chat')).entry.text,'still works');
 send(guest,{type:'refresh'});const state=await wait(guest,m=>m.type==='state'&&m.chat?.some(e=>e.text==='still works'));assert.ok(!state.chat.some(e=>e.source==='tiktok'),'upstream comments never enter persisted/game chat');
});
