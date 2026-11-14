import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createApplication} from '../server/application.mjs';
import {createMemoryBackend,createMemoryStore,createRedisStore} from '../server/room-store.mjs';
import {createConnection} from '../public/connection.js';

test('slow storage coalesces queued movement without overtaking seat commands',async t=>{
 const memory=createMemoryStore();let hold=false,release,entered;
 const started=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
 const store={...memory,async transact(key,mutate){if(hold){hold=false;entered();await gate;}return memory.transact(key,mutate);}};
 const app=createApplication({store,ice:[]}),messages=[];
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=movement`);
 t.after(async()=>{release();ws.terminate();await app.close();});
 ws.on('message',raw=>messages.push(JSON.parse(raw)));
 async function wait(predicate){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){const found=messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,5));}
  throw new Error('Movement update missing');
 }
 await once(ws,'open');const send=message=>ws.send(JSON.stringify(message));send({type:'join'});
 await wait(m=>m.type==='state');send({type:'seat',index:-1});await wait(m=>m.type==='state'&&m.users[0].seat===-1);
 hold=true;const move=x=>({type:'move',x,z:0,yaw:0,pitch:0,gait:'walkRight'});
 send(move(0));await started;
 for(let i=1;i<=100;i++)send(move(i/100));
 send({type:'seat',index:2});send(move(8));
 // A name update acknowledges the entire command sequence.
 send({type:'name',value:'done'});
 await new Promise(r=>setTimeout(r,40));release();
 const final=await wait(m=>m.type==='state'&&m.users[0].name==='done');
 assert.equal(final.users[0].seat,2);assert.equal(final.users[0].x,1.9);
 const poses=messages.filter(m=>m.type==='pose');
 assert.deepEqual(poses.map(m=>m.user.x),[0,1,1.9]);
 assert.equal(ws.readyState,WebSocket.OPEN,'movement burst must not close the session');
});

async function exerciseSharedRooms(t,stores){
 let clock=Date.now();
 const apps=stores.map(store=>createApplication({store,now:()=>clock,ice:[],resumeGraceMs:45000}));
 const sockets=[];
 t.after(async()=>{for(const socket of sockets)socket.terminate();await Promise.all(apps.map(app=>app.close()));});
 for(const app of apps){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
 async function wait(client,predicate){
  const end=Date.now()+5000;
  while(Date.now()<end){const index=client.messages.findIndex(predicate);if(index>=0)return client.messages.splice(index,1)[0];await new Promise(r=>setTimeout(r,5));}
  throw new Error('Shared room update missing');
 }
 async function connect(instance,token,room='shared'){
  const ws=new WebSocket(`ws://127.0.0.1:${apps[instance].server.address().port}/api/live?room=${room}`),messages=[];
  sockets.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');
  ws.send(JSON.stringify({type:'join',...(token?{resumeToken:token}:{})}));
  const client={ws,messages};client.hello=await wait(client,m=>m.type==='hello');return client;
 }
 const [a,b]=await Promise.all([connect(0),connect(1)]);
 const id=a.hello.id,other=b.hello.id;
 const both=await wait(b,m=>m.type==='state'&&m.users.length===2);
 assert.equal(new Set(both.users.map(u=>u.seat)).size,2,'concurrent joins allocate distinct seats');
 assert.ok(!JSON.stringify(both).includes(a.hello.resumeToken),'resume secrets never reach other players');
 a.ws.send(JSON.stringify({type:'appearance',face:6,skin:4}));
 await wait(b,m=>m.type==='state'&&m.users.find(u=>u.id===id)?.skin===4);
 a.ws.send(JSON.stringify({type:'queue',video:'abcdefghijk',title:'Keep this song'}));
 const singing=await wait(b,m=>m.type==='state'&&m.song?.owner===id),songKey=singing.song.key;
 b.ws.send(JSON.stringify({type:'queue',video:'lmnopqrstuv',title:'Next'}));
 await wait(a,m=>m.type==='state'&&m.queue.length===1);
 a.ws.send(JSON.stringify({type:'signal',to:other,signal:{candidate:'one'}}));
 assert.equal((await wait(b,m=>m.type==='signal')).from,id,'signalling crosses process boundaries');
 a.ws.close();await once(a.ws,'close');clock+=1000;
 const resumed=await connect(1,a.hello.resumeToken);
 assert.equal(resumed.hello.id,id,'a different instance restores the same identity');
 const restored=await wait(resumed,m=>m.type==='state'&&m.users.length===2&&m.song?.key===songKey);
 assert.equal(restored.users.find(u=>u.id===id).face,6);assert.equal(restored.users.find(u=>u.id===id).skin,4);
 assert.equal(restored.queue.length,1);
 const isolated=await connect(0,undefined,'another');
 const separate=await wait(isolated,m=>m.type==='state');assert.equal(separate.users.length,1);assert.equal(separate.song,null);
 const replaced=once(resumed.ws,'close'),duplicate=await connect(0,a.hello.resumeToken);
 await replaced;assert.equal(duplicate.hello.id,id,'session takeover preserves the room member');
 duplicate.ws.close();await once(duplicate.ws,'close');clock+=61000;
 // Joining after lease expiry cleans stale members and their queue atomically.
 const newcomer=await connect(1);
 const cleaned=await wait(newcomer,m=>m.type==='state'&&m.users.length===1);
 assert.equal(cleaned.song,null);assert.deepEqual(cleaned.queue,[]);
}
test('two application instances share rooms and preserve the singer on reconnect',async t=>{
 const backend=createMemoryBackend();await exerciseSharedRooms(t,[createMemoryStore(backend),createMemoryStore(backend)]);
});
test('real Redis atomically shares rooms, pub/sub and reconnect state',{skip:!process.env.TEST_REDIS_URL},async t=>{
 const prefix='karaoke-test:'+randomUUID();
 await exerciseSharedRooms(t,[createRedisStore({url:process.env.TEST_REDIS_URL,prefix}),createRedisStore({url:process.env.TEST_REDIS_URL,prefix})]);
});
test('cloud endpoint fails closed when Redis is missing',async t=>{
 const app=createApplication({requireRedis:true,ice:[]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.close());
 const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/live`);
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{status:'unavailable'});
});

test('automatic Function rotation reconnects without losing the singer or queued song',async t=>{
 const app=createApplication({ice:[],rotateAfterMs:250});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const values=new Map(),hellos=[],states=[];
 const connection=createConnection({room:'rotation',url:`ws://127.0.0.1:${app.server.address().port}/api/live?room=rotation`,WebSocketClass:WebSocket,
  storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  onHello:m=>hellos.push(m),onMessage:m=>{if(m.type==='state')states.push(m);},
 });
 t.after(async()=>{connection.close();await app.close();});
 async function until(predicate){const end=Date.now()+4000;while(!predicate()){if(Date.now()>end)throw new Error('Rotation did not recover');await new Promise(r=>setTimeout(r,5));}}
 connection.connect();await until(()=>hellos.length===1);
 const id=hellos[0].id;
 connection.send({type:'queue',video:'abcdefghijk',title:'Keep singing'});
 await until(()=>states.some(s=>s.song?.owner===id));
 connection.send({type:'queue',video:'lmnopqrstuv',title:'Keep waiting'});
 await until(()=>states.some(s=>s.queue.length===1));
 await until(()=>hellos.length>=2&&states.at(-1)?.queue.length===1);
 assert.equal(hellos[1].id,id);assert.equal(states.at(-1).song.owner,id);assert.equal(states.at(-1).song.title,'Keep singing');
});
