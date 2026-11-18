import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyRoom,joinMember,applyMessage} from '../server/room-state.mjs';

test('retired emote commands cannot start a dance on animal avatars',()=>{
 const room=emptyRoom();joinMember(room,{id:'one',connectionId:'one',token:'token'},1000);
 applyMessage(room,'one','one',{type:'queue',video:'abcdefghijk'},1000);
 const result=applyMessage(room,'one','one',{type:'emote',key:room.song.key,on:true,emote:'wolf'},2000);
 assert.deepEqual(result.events,[]);assert.equal(room.users.get('one').data.emoteAt,0);
});

test('profile offers animals without human face, skin, clothing or emote controls',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/id="animal-picker"/);assert.match(html,/id="animal-preview"/);
 for(const id of ['emote','emote-choice','room-emote-choice','face-picker','skin-picker','shirt-picker','room-animal-picker'])assert.ok(!html.includes('id="'+id+'"'),id+' is removed');
});
