import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createApplication} from '../server/application.mjs';

test('rooms isolate users and queue; only the singer advances; disconnect advances the queue', async t => {
  const app = createApplication({ice: [],resumeGraceMs:0});
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => app.close());
  const port = app.server.address().port;
  async function connect(room) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/live?room=${room}`);
    const messages = [];
    ws.on('message', raw => messages.push(JSON.parse(raw)));
    await once(ws, 'open');
    ws.send(JSON.stringify({type:'join'}));
    return {ws, messages};
  }
  async function wait(client, predicate) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const index = client.messages.findIndex(predicate);
      if (index >= 0) return client.messages.splice(index, 1)[0];
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Expected room state was not received');
  }
  const first = await connect('one'), second = await connect('one'), other = await connect('two');
  const firstId = (await wait(first, m => m.type === 'hello')).id;
  const secondId = (await wait(second, m => m.type === 'hello')).id;
  const otherId = (await wait(other, m => m.type === 'hello')).id;
  const otherState = await wait(other, m => m.type === 'state');
  assert.deepEqual(otherState.users.map(u => u.id), [otherId]);
  const send = (client, message) => client.ws.send(JSON.stringify(message));
  for(let skin=0;skin<6;skin++){
    send(first,{type:'appearance',skin});
    const appearance=await wait(second,m=>m.type==='state'&&m.users.some(u=>u.id===firstId&&u.skin===skin));
    assert.equal(appearance.users.find(u=>u.id===firstId).skin,skin);
  }
  for(const skin of [-1,6,1.5,'2',null])send(first,{type:'appearance',skin});
  for(let face=0;face<9;face++){
    send(first,{type:'appearance',face});
    const appearance=await wait(second,m=>m.type==='state'&&m.users.some(u=>u.id===firstId&&u.face===face));
    assert.equal(appearance.users.find(u=>u.id===firstId).face,face);
  }
  for(const face of [-1,9,1.5,'2',null])send(first,{type:'appearance',face});
  send(first,{type:'name',value:'Appearance validated'});
  const validated=await wait(second,m=>m.type==='state'&&m.users.some(u=>u.name==='Appearance validated'));
  assert.equal(validated.users.find(u=>u.id===firstId).face,8);
  assert.equal(validated.users.find(u=>u.id===firstId).skin,5,'invalid skin updates must leave the previous selection intact');
  for(const yaw of [Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2,Math.PI*5]){
    send(first,{type:'move',x:0,z:11,yaw,pitch:0,gait:'idle'});
    const pose=await wait(second,m=>m.type==='pose'&&m.user.id===firstId);
    assert.equal(pose.user.bodyYaw,0);
    assert.ok(Math.abs(Math.sin(pose.user.yaw)-Math.sin(yaw))<1e-9);
    assert.ok(Math.abs(Math.cos(pose.user.yaw)-Math.cos(yaw))<1e-9);
  }
  send(first, {type: 'queue', video: 'abcdefghijk', title: 'First'});
  const singing = await wait(first, m => m.type === 'state' && m.song?.owner === firstId);
  assert.equal(singing.users.find(u => u.id === firstId).seat, -1);
  assert.equal(singing.users.find(u => u.id === firstId).face,8);
  assert.equal(singing.users.find(u => u.id === firstId).bodyYaw,Math.PI);
  send(second, {type: 'queue', video: 'lmnopqrstuv', title: 'Second'});
  await wait(first, m => m.type === 'state' && m.queue.length === 1);
  send(second, {type: 'next', key: singing.song.key});
  send(second, {type: 'name', value: 'Spectator cannot skip'});
  const refused = await wait(first, m => m.type === 'state' && m.users.some(u => u.name === 'Spectator cannot skip'));
  assert.equal(refused.song.key, singing.song.key);
  send(first, {type: 'next', key: singing.song.key});
  const next = await wait(second, m => m.type === 'state' && m.song?.owner === secondId);
  assert.equal(next.queue.length, 0);
  send(first, {type: 'queue', video: '12345678901', title: 'After disconnect'});
  await wait(first, m => m.type === 'state' && m.queue.some(s => s.title === 'After disconnect'));
  second.ws.close();
  await once(second.ws, 'close');
  const advanced = await wait(first, m => m.type === 'state' && m.song?.title === 'After disconnect');
  assert.equal(advanced.song.owner, firstId);
  assert.equal(advanced.users.length, 1);
  send(other, {type: 'name', value: 'Separate room'});
  const isolated = await wait(other, m => m.type === 'state' && m.users[0]?.name === 'Separate room');
  assert.equal(isolated.song, null);assert.deepEqual(isolated.queue, []);
});
