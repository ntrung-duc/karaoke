import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {TokenVerifier} from 'livekit-server-sdk';
import {createApplication} from '../server/application.mjs';
import {createMemoryStore} from '../server/room-store.mjs';
import {stateEvent,snapshot} from '../server/room-state.mjs';

test('five-player game sends only personal secrets, isolates voice/chat, advances on a timer and resumes a role',async t=>{
 const store=createMemoryStore(),app=createApplication({store,ice:[],livekitUrl:'wss://voice.example',livekitApiKey:'test-key',livekitApiSecret:'test-secret'}),clients=[];
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{for(const c of clients)c.ws.terminate();await app.close();});
 async function wait(c,predicate){const until=Date.now()+4000;while(Date.now()<until){const i=c.messages.findIndex(predicate);if(i>=0)return c.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}throw new Error('Werewolf state missing');}
 async function join(token){const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=wolves`),c={ws,messages:[]};clients.push(c);ws.on('message',raw=>c.messages.push(JSON.parse(raw)));await once(ws,'open');ws.send(JSON.stringify({type:'join',resumeToken:token}));c.hello=await wait(c,m=>m.type==='hello');return c;}
 const host=await join();const send=(c,m)=>c.ws.send(JSON.stringify(m));
 send(host,{type:'room-mode',mode:'werewolf',hostVersion:1,requestId:'open-wolves'});const lobby=(await wait(host,m=>m.type==='control-result'&&m.requestId==='open-wolves')).snapshot;assert.equal(lobby.mode,'werewolf');
 for(let i=0;i<4;i++)await join();
 for(const c of clients){send(c,{type:'ww-join',gameId:lobby.werewolf.id,join:true});send(c,{type:'ww-ready',gameId:lobby.werewolf.id,ready:true});}
 await wait(host,m=>m.type==='state'&&m.werewolf?.players.length===5&&m.werewolf.players.every(p=>p.ready));
 send(host,{type:'ww-start',gameId:lobby.werewolf.id,requestId:'start-wolves'});const start=(await wait(host,m=>m.type==='control-result'&&m.requestId==='start-wolves')).snapshot;
 assert.equal(start.werewolf.phase,'night');const views=[];for(const c of clients){const view=await wait(c,m=>m.type==='state'&&m.werewolf?.phase==='night');views.push(view);assert.ok(view.wwPrivate.role);assert.ok(view.werewolf.players.every(p=>p.role===undefined));assert.equal(view.views,undefined);}
 const roles=views.map(v=>v.wwPrivate.role);assert.equal(roles.filter(r=>r==='wolf').length,1);assert.equal(roles.filter(r=>r==='seer').length,1);
 const wolfIndex=roles.indexOf('wolf'),wolf=clients[wolfIndex],seer=clients[roles.indexOf('seer')];
 send(wolf,{type:'chat',text:'wolf-only-secret',clientId:'wolf-private-001'});await wait(wolf,m=>m.type==='chat'&&m.entry.text==='wolf-only-secret');
 send(seer,{type:'refresh'});const seerState=await wait(seer,m=>m.type==='state'&&m.werewolf?.phase==='night');assert.ok(!JSON.stringify(seerState).includes('wolf-only-secret'));
 const timerState=await store.transact('wolves',room=>{room.werewolf.until=Date.now()+100;room.werewolf.version++;return {events:[stateEvent(room,Date.now())],version:room.werewolf.version};});
 const advanced=await wait(host,m=>m.type==='state'&&m.werewolf?.version>timerState.version);assert.equal(advanced.werewolf.phase,'night','next role is called by server timer');
 await store.transact('wolves',room=>{room.werewolf.phase='day';room.werewolf.step=null;room.werewolf.version++;room.werewolf.until=Date.now()+60000;room.werewolf.players[4].alive=false;for(const member of room.users.values())member.chatAt=0;return {events:[stateEvent(room,Date.now())]};});
 const day=await wait(host,m=>m.type==='state'&&m.werewolf?.phase==='day');
 const aliveIndex=day.werewolf.players.findIndex(p=>p.id!==clients[4].hello.id),alive=clients.find(c=>c.hello.id===day.werewolf.players[aliveIndex].id),dead=clients.find(c=>c.hello.id===day.werewolf.players[4].id);
 send(alive,{type:'refresh'});const aliveView=await wait(alive,m=>m.type==='state'&&m.werewolf?.phase==='day');send(dead,{type:'refresh'});const deadView=await wait(dead,m=>m.type==='state'&&m.werewolf?.phase==='day');assert.notEqual(aliveView.wwPrivate.voice.key,deadView.wwPrivate.voice.key);
 send(alive,{type:'voice-session',key:deadView.wwPrivate.voice.key});send(alive,{type:'voice-session',key:aliveView.wwPrivate.voice.key});const credentials=await wait(alive,m=>m.type==='voice-session');const claims=await new TokenVerifier('test-key','test-secret').verify(credentials.token);assert.match(claims.video.room,/^werewolf-/);assert.equal(claims.video.canPublish,true);assert.equal(credentials.key,aliveView.wwPrivate.voice.key);
 send(dead,{type:'chat',text:'spectator-secret',clientId:'grave-private-001'});await wait(dead,m=>m.type==='chat'&&m.entry.text==='spectator-secret');send(alive,{type:'refresh'});const clean=await wait(alive,m=>m.type==='state'&&m.werewolf?.phase==='day');assert.ok(!JSON.stringify(clean).includes('spectator-secret'));
 const originalRole=roles[clients.indexOf(seer)];seer.ws.close();await once(seer.ws,'close');const resumed=await join(seer.hello.resumeToken);assert.equal(resumed.hello.id,seer.hello.id);const resumedView=await wait(resumed,m=>m.type==='state'&&m.werewolf?.phase==='day');assert.equal(resumedView.wwPrivate.role,originalRole);
 const publicOnly=await store.transact('wolves',room=>({state:snapshot(room,Date.now())}));assert.equal(publicOnly.state.wwPrivate,null);assert.ok(!JSON.stringify(publicOnly.state).includes('wolf-only-secret'));
});
