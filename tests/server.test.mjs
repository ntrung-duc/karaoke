import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';

test('two users receive validated movement, authoritative jumps and seat resets',async t=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 const port=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(new Error('server did not start')),5000);
  child.stdout.on('data',d=>{output+=d;const m=output.match(/localhost:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
  child.once('error',reject);
 });
 for(const path of ['/input.js','/player-state.js','/camera-controls.js','/avatar.js','/avatar-head.js','/block-avatar.js','/toy-avatar.js','/faces.js','/avatar-settings.js','/scenery.js','/session.js','/motion.js','/assets/face-atlas.png','/assets/human-motions.json','/assets/mannequin.glb','/lib/loaders/GLTFLoader.js','/lib/utils/BufferGeometryUtils.js','/lib/utils/SkeletonUtils.js']){
  const response=await fetch(`http://127.0.0.1:${port}${path}`);assert.equal(response.status,200);
  if(path.endsWith('.json'))assert.match(response.headers.get('content-type'),/application\/json/);
  if(path.endsWith('.glb'))assert.equal(response.headers.get('content-type'),'model/gltf-binary');
 }
 for(const path of ['/.env','/server.mjs','/tools/prepare-mannequin.mjs'])assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status,404);
 const health=await fetch(`http://127.0.0.1:${port}/healthz`);
 assert.equal(health.status,200);assert.equal(health.headers.get('cache-control'),'no-store');assert.deepEqual(await health.json(),{status:'ok'});
 const healthHead=await fetch(`http://127.0.0.1:${port}/healthz`,{method:'HEAD'});
 assert.equal(healthHead.status,200);assert.equal((await healthHead.text()).length,0);
 assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`,{method:'POST'})).status,405);
 assert.equal((await fetch(`http://127.0.0.1:${port}/`,{method:'POST'})).status,405);
 const head=await fetch(`http://127.0.0.1:${port}/assets/mannequin.glb`,{method:'HEAD'});
 assert.equal(head.status,200);assert.ok(Number(head.headers.get('content-length'))>0);assert.equal((await head.arrayBuffer()).byteLength,0);
 async function connect(){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/live?room=motion-test`),messages=[];
  ws.on('message',raw=>messages.push(JSON.parse(raw)));await once(ws,'open');
  t.after(()=>ws.close());return {ws,messages};
 }
 async function wait(client,predicate){
  const end=Date.now()+3000;
  while(Date.now()<end){const index=client.messages.findIndex(predicate);if(index>=0)return client.messages.splice(index,1)[0];await new Promise(r=>setTimeout(r,10));}
  throw new Error('Expected message was not received');
 }
 const one=await connect(),hello=await wait(one,m=>m.type==='hello'),id=hello.id,two=await connect();
 const send=m=>one.ws.send(JSON.stringify(m));
 send({type:'jump'});send({type:'name',value:'Seated'});
 const seated=await wait(one,m=>m.type==='state'&&m.users.some(u=>u.name==='Seated'));
 assert.equal(seated.users.find(u=>u.id===id).jumpAt,0);
 send({type:'seat',index:-1});
 await wait(one,m=>m.type==='state'&&m.users.find(u=>u.id===id)?.seat===-1);
 send({type:'move',x:0,z:11,yaw:0,pitch:0,gait:'runForward'});
 const move=await wait(two,m=>m.type==='pose'&&m.user.id===id&&m.user.gait==='runForward');
 assert.equal(move.user.z,11);assert.ok(move.user.movingUntil>Date.now()-1000);
 send({type:'jump'});
 const jump=await wait(two,m=>m.type==='pose'&&m.user.id===id&&m.user.jumpAt>0);
 assert.ok(Math.abs(Date.now()-jump.user.jumpAt)<1000);
 send({type:'seat',index:-999});send({type:'name',value:'After invalid seat'});
 const unchanged=await wait(two,m=>m.type==='state'&&m.users.some(u=>u.name==='After invalid seat'));
 assert.equal(unchanged.users.find(u=>u.id===id).jumpAt,jump.user.jumpAt);
 send({type:'jump'});send({type:'move',x:0,z:10.9,yaw:0,pitch:0,gait:'invalid'});
 const subsequent=await wait(two,m=>m.type==='pose'&&m.user.id===id&&m.user.z===10.9);
 assert.equal(subsequent.user.jumpAt,jump.user.jumpAt);assert.equal(subsequent.user.gait,'idle');
 send({type:'move',x:0,z:NaN,yaw:0,pitch:0,gait:'walkForward'});
 send({type:'seat',index:0});
 const reset=await wait(two,m=>m.type==='state'&&m.users.find(u=>u.id===id)?.seat===0);
 assert.equal(reset.users.find(u=>u.id===id).jumpAt,0);
 assert.equal(reset.users.find(u=>u.id===id).gait,'idle');
});
