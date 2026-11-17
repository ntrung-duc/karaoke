import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnection} from '../public/connection.js';

test('reconnect resumes the same tab, rejects old socket events and backs off when the server is unavailable',()=>{
 const sockets=[],timers=[],values=new Map(),messages=[],hello=[],status=[];
 class Socket{
  constructor(url){this.url=url;this.readyState=1;this.sent=[];sockets.push(this);}
  send(raw){this.sent.push(JSON.parse(raw));}
  close(){this.onclose?.({code:1000});}
  receive(message){this.onmessage({data:JSON.stringify(message)});}
 }
 const transport=createConnection({room:'test',url:'wss://example.test/api/live?room=test',
  WebSocketClass:Socket,storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  setTimer:(fn,delay)=>{if(delay!==12000)timers.push({fn,delay});return timers.length;},clearTimer:()=>{},random:()=>.5,
  onHello:m=>hello.push(m),onMessage:m=>messages.push(m),onStatus:s=>status.push(s),
 });
 transport.connect();sockets[0].onopen();assert.deepEqual(sockets[0].sent,[{type:'join'}]);
 assert.equal(transport.send({type:'name',value:'Too early'}),false);
 sockets[0].receive({type:'hello',id:'same-player',resumeToken:'secret'});
 assert.equal(transport.send({type:'name',value:'Player'}),true);
 sockets[0].receive({type:'state',revision:8});sockets[0].receive({type:'state',revision:7});
 assert.equal(messages.length,1,'older snapshots cannot pull the player back');
 sockets[0].onclose({code:1012});assert.equal(timers[0].delay,500);timers[0].fn();sockets[1].onopen();
 assert.deepEqual(sockets[1].sent,[{type:'join',resumeToken:'secret'}]);assert.ok(!sockets[1].url.includes('secret'));
 sockets[0].receive({type:'hello',id:'obsolete',resumeToken:'wrong'});assert.equal(hello.length,1);
 sockets[1].onclose({code:1013});assert.equal(timers[1].delay,1000);
 timers[1].fn();sockets[2].onopen();sockets[2].receive({type:'hello',id:'same-player',resumeToken:'secret'});
 sockets[2].receive({type:'state',revision:2});assert.equal(messages.at(-1).revision,2,'restored checkpoint may have a lower revision after restart');
 sockets[2].receive({type:'state',revision:1});assert.equal(messages.at(-1).revision,2,'stale messages are still rejected within the new socket');
 sockets[2].receive({type:'state',revision:9});assert.equal(messages.at(-1).revision,9);
 sockets[2].onclose({code:4001});timers[2].fn();sockets[3].onopen();
 assert.deepEqual(sockets[3].sent,[{type:'join'}],'a superseded session starts a separate player instead of stealing the session back');
 const scheduled=timers.length;transport.close();assert.equal(timers.length,scheduled,'explicit close must not schedule a reconnect');
});

test('a connection that opens without a server hello times out and retries',()=>{
 const timers=[],sockets=[];
 class Socket{
  constructor(){this.readyState=1;sockets.push(this);}
  send(){}
  close(){this.onclose({code:1000});}
 }
 const transport=createConnection({room:'test',url:'wss://example.test/api/live',WebSocketClass:Socket,storage:null,setTimer:(fn,delay)=>{timers.push({fn,delay});},clearTimer:()=>{},random:()=>.5});
 transport.connect();sockets[0].onopen();assert.equal(timers[0].delay,12000);
 timers[0].fn();assert.equal(timers[1].delay,500);transport.close();
});
