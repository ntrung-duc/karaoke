import test from 'node:test';
import assert from 'node:assert/strict';
import {createYouTubeSearch,searchQuery,quotaDay} from '../server/youtube-search.mjs';
import {createMemoryBackend,createMemoryStore} from '../server/room-store.mjs';
import {createApplication} from '../server/application.mjs';
import {once} from 'node:events';
import {WebSocket} from 'ws';

const response={items:[{id:{videoId:'abcdefghijk'},snippet:{title:'Bài hát &amp; karaoke',channelTitle:'Kênh hát'}},{id:{videoId:'invalid'},snippet:{title:'Wrong'}}]};
test('query validation and Pacific quota reset match the upstream contract',()=>{
 assert.equal(searchQuery('  Nơi   này có anh  '),'Nơi này có anh karaoke');
 assert.equal(searchQuery('Nơi này karaoke'),'Nơi này karaoke');
 assert.equal(searchQuery('Tên bài',false),'Tên bài');
 for(const query of [null,'a','a'.repeat(101)])assert.throws(()=>searchQuery(query));
 assert.equal(quotaDay(Date.parse('2026-11-15T07:59:59Z')),'2026-11-14');
 assert.equal(quotaDay(Date.parse('2026-11-15T08:00:00Z')),'2026-11-15');
});
test('shared cache avoids API calls across instances; cooldown and daily cap persist',async()=>{
 const backend=createMemoryBackend(),store=createMemoryStore(backend);let time=Date.parse('2026-11-15T12:00:00Z'),calls=0;
 const fetch=async url=>{calls++;assert.equal(url.origin,'https://www.googleapis.com');assert.equal(url.searchParams.get('videoEmbeddable'),'true');assert.equal(url.searchParams.get('type'),'video');return {ok:true,json:async()=>response};};
 const one=createYouTubeSearch({store,apiKey:'test-only',fetch,now:()=>time}),two=createYouTubeSearch({store:createMemoryStore(backend),apiKey:'test-only',fetch,now:()=>time});
 const result=await one('user','Nơi này');assert.equal(result.items.length,1);assert.equal(result.items[0].video,'abcdefghijk');assert.equal(calls,1);
 assert.equal((await two('other','NƠI NÀY')).cached,true);assert.equal(calls,1);
 await assert.rejects(()=>one('user','Khác'),/4 giây/);
 for(let i=1;i<90;i++){time+=4001;await (i%2?one:two)('user','Bài '+i);}
 assert.equal(calls,90);time+=4001;await assert.rejects(()=>two('user','Vượt hạn mức'),/hết lượt/);assert.equal(calls,90);
 assert.equal((await one('user','Bài 89')).cached,true,'cached results work after reaching the cap');
 time+=86400000;await one('user','Ngày mới');assert.equal(calls,91);
});
test('concurrent queries reserve quota once; missing keys and upstream errors stay safe',async()=>{
 const backend=createMemoryBackend(),store=createMemoryStore(backend);let release;
 const pending=new Promise(resolve=>release=resolve);
 const one=createYouTubeSearch({store,apiKey:'secret-test-key',fetch:async()=>{await pending;return {ok:true,json:async()=>response};}});
 const two=createYouTubeSearch({store:createMemoryStore(backend),apiKey:'secret-test-key'});
 const first=one('one','Bài hát');await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>two('two','Bài hát'),/đang được tìm/);release();await first;
 const missing=createYouTubeSearch({store});await assert.rejects(()=>missing('three','Tên bài'),/chưa được bật/);
 const failed=createYouTubeSearch({store,apiKey:'secret-test-key',fetch:async()=>{throw new Error('https://example.com?key=secret-test-key');}});
 await assert.rejects(()=>failed('four','Lỗi mạng'),error=>!error.message.includes('secret-test-key')&&error.message.includes('phản hồi chậm'));
 const quota=createYouTubeSearch({store,apiKey:'secret-test-key',fetch:async()=>({ok:false,json:async()=>({error:{errors:[{reason:'quotaExceeded'}]}})})});
 await assert.rejects(()=>quota('five','Lỗi quota'),/hết lượt/);
});

test('a pending YouTube request does not hold movement, jump or chat commands',async t=>{
 const original=globalThis.fetch;let release,entered;
 const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 globalThis.fetch=async()=>{entered();await gate;return {ok:true,json:async()=>response};};
 const app=createApplication({youtubeApiKey:'test-only'}),messages=[];
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/api/live?room=search-test`);
 t.after(async()=>{release();globalThis.fetch=original;ws.terminate();await app.close();});
 ws.on('message',raw=>messages.push(JSON.parse(raw)));
 const send=message=>ws.send(JSON.stringify(message));
 async function wait(predicate){
  const until=Date.now()+3000;
  while(Date.now()<until){const found=messages.find(predicate);if(found)return found;await new Promise(resolve=>setTimeout(resolve,5));}
  throw new Error('Expected WebSocket response missing');
 }
 await once(ws,'open');send({type:'join'});await wait(m=>m.type==='hello');
 send({type:'seat',index:-1});await wait(m=>m.type==='state'&&m.users[0].seat<0);
 send({type:'search',requestId:'search-one',query:'Tên bài'});await started;
 send({type:'move',x:0,z:0,yaw:0,pitch:0,gait:'walkForward'});await wait(m=>m.type==='pose'&&m.user.x===0&&m.user.z===0);
 send({type:'jump'});await wait(m=>m.type==='pose'&&m.user.jumpAt>0);
 send({type:'chat',clientId:'search-test-chat',text:'Vẫn chat được'});await wait(m=>m.type==='chat');
 assert.ok(!messages.some(m=>m.type==='search-results'),'all controls complete before the API request');
 release();const results=await wait(m=>m.type==='search-results');assert.equal(results.items[0].video,'abcdefghijk');
});
