import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRoom,joinMember,applyMessage,snapshot,stateEvent,disconnectMember,encodeRoom,decodeRoom} from '../server/room-state.mjs';
import {createWerewolf,werewolfCommand,tickWerewolf,privateWerewolf,publicWerewolf,werewolfVoice,chatChannel,readWerewolfChat,leaveWerewolf} from '../server/werewolf.mjs';
import {WW_ROLES,WW_STEPS} from '../public/werewolf-rules.js';

function fixture(roles=['wolf','seer','guard','villager','villager']){
 const room=emptyRoom();for(let i=0;i<roles.length;i++){joinMember(room,{id:'p'+i,connectionId:'s'+i,token:'token'+i},1000);room.users.get('p'+i).expiresAt=1e9;}
 room.mode='werewolf';const g=room.werewolf=createWerewolf();g.players=roles.map((role,i)=>({id:'p'+i,name:'Người '+i,animal:'cat',role,alive:true,ready:true}));g.initialRoles=[...roles];g.phase='night';g.step='wolves';g.steps=['wolves'];g.day=1;g.version=1;g.until=10000;g.night={slots:1};
 const send=(i,type,extra={})=>werewolfCommand(room,'p'+i,{type,gameId:g.id,version:g.version,...extra},2000,max=>max-1);
 const action=(i,targets,extra={})=>send(i,'ww-action',{targets:targets.map(j=>'p'+j),...extra});
 const step=name=>{g.phase='night';g.step=name;g.steps=[name];g.actions={};g.night={slots:1};g.version++;g.until=10000;};
 const tick=()=>tickWerewolf(room,g.until);
 return {room,g,send,action,step,tick,p:i=>g.players[i]};
}

test('26 roles are selectable; only connected ready players are dealt and stale actions are rejected',()=>{
 assert.equal(Object.keys(WW_ROLES).length,26);
 const f=fixture();f.g.phase='lobby';f.g.players.forEach(p=>delete p.role);
 f.g.players[4].ready=false;assert.match(f.send(0,'ww-start'),/sẵn sàng/);f.g.players[4].ready=true;
 assert.equal(f.send(1,'ww-start'),'Chỉ chủ phòng được bắt đầu ván.');assert.equal(f.send(0,'ww-start'),null);
 assert.equal(f.g.players.filter(p=>p.role==='wolf').length,1);assert.equal(f.g.players.length,5);
 assert.ok(f.g.players.some(p=>p.role==='seer'));assert.ok(f.g.players.some(p=>p.role==='guard'));
 assert.match(werewolfCommand(f.room,'p0',{type:'ww-action',gameId:'old',version:0},2000),/Ván/);
 assert.match(werewolfCommand(f.room,'p0',{type:'ww-action',gameId:f.g.id,version:-1},2000),/Lượt/);
 const big=fixture(Array(20).fill('villager'));big.g.phase='lobby';big.g.settings.roles=Object.keys(WW_ROLES).filter(r=>!['wolf','villager'].includes(r));
 assert.equal(big.send(0,'ww-start'),null);assert.equal(big.g.players.length,20);assert.equal(big.g.players.filter(p=>['wolf','wolfcub','wolffather','whitewolf'].includes(p.role)).length,5);
 assert.equal(big.g.players.filter(p=>p.role==='sisters').length%2,0,'sisters are always paired');
});

test('public snapshots never contain living identities, visions or wolf selections; resume preserves own role',()=>{
 const f=fixture();f.g.actions.p0={targets:['p4']};f.p(1).vision={targets:['p0'],result:'wolf'};
 const common=publicWerewolf(f.room);assert.ok(common.players.every(p=>p.role===undefined));assert.equal(common.actions,undefined);
 assert.equal(snapshot(f.room,2000).wwPrivate,null);assert.equal(snapshot(f.room,2000,'p0').wwPrivate.role,'wolf');assert.equal(snapshot(f.room,2000,'p0').wwPrivate.vision,null);
 assert.equal(snapshot(f.room,2000,'p1').wwPrivate.wolfChoices,null);assert.equal(snapshot(f.room,2000,'p4').wwPrivate.lastGuard,undefined);
 const event=stateEvent(f.room,2000);assert.equal(event.message.wwPrivate,null);assert.equal(event.views.p1.wwPrivate.role,'seer');assert.equal(event.views.p4.wwPrivate.role,'villager');
 disconnectMember(f.room,'p1','s1',2000);const resumed=joinMember(f.room,{id:'new',connectionId:'new-socket',token:'new-token',resumeToken:'token1'},3000);assert.equal(resumed.id,'p1');
 const copy=decodeRoom(encodeRoom(f.room));assert.equal(privateWerewolf(copy,'p1').role,'seer');
});

test('guard, seer, apprentice, detective and lycan use server-only information',()=>{
 const f=fixture(['wolf','seer','apprentice','guard','detective','lycan','villager','villager']);
 f.step('guard');assert.equal(f.action(3,[6]),null);f.g.day++;f.step('guard');assert.match(f.action(3,[6]),/hai đêm/);assert.equal(f.action(3,[3]),null);
 f.step('seer');assert.equal(f.action(1,[5]),null);assert.equal(f.p(1).vision.result,'wolf');assert.match(f.action(1,[0]),/xác nhận/);
 f.step('detective');assert.equal(f.action(4,[3,5]),null);assert.equal(f.p(4).vision.result,'same');
 f.step('wolves');f.action(0,[1]);f.tick();assert.equal(f.p(1).alive,false);assert.equal(f.p(2).role,'seer');
});

test('witch saves the first wolf target or poisons, spends each bottle once and cannot self-save',()=>{
 const f=fixture(['wolf','witch','guard','villager','villager','villager']);
 f.step('witch');f.g.actions.p0={targets:['p4']};assert.equal(privateWerewolf(f.room,'p1').victim,'p4');assert.equal(f.action(1,[],{use:'heal'}),null);assert.equal(f.p(1).healUsed,true);
 f.tick();assert.equal(f.p(4).alive,true);
 f.step('witch');f.g.actions.p0={targets:['p4']};assert.match(f.action(1,[],{use:'heal'}),/Không thể/);assert.equal(f.action(1,[0],{use:'poison'}),null);f.tick();assert.equal(f.p(0).alive,false);
 const self=fixture(['wolf','witch','villager','villager','villager']);self.step('witch');self.g.actions.p0={targets:['p1']};assert.match(self.action(1,[],{use:'heal'}),/Không thể/);
 const two=fixture(['wolf','witch','villager','villager','villager','villager']);two.step('witch');two.g.night.slots=2;two.g.actions.p0={targets:['p2','p3']};assert.equal(two.action(1,[3],{use:'heal'}),null);two.tick();assert.equal(two.p(2).alive,false);assert.equal(two.p(3).alive,true);
});

test('elder resists one wolf bite, cursed converts, father infects once, and a cub grants two targets next night',()=>{
 const f=fixture(['wolf','elder','cursed','villager','villager','villager']);f.action(0,[1]);f.tick();assert.equal(f.p(1).alive,true);assert.equal(f.p(1).elderHit,true);
 f.step('wolves');f.action(0,[1]);f.tick();assert.equal(f.p(1).alive,false);
 const cursed=fixture(['wolf','cursed','villager','villager','villager','villager']);cursed.action(0,[1]);cursed.tick();assert.equal(cursed.p(1).role,'wolf');assert.equal(cursed.p(1).alive,true);
 const father=fixture(['wolffather','villager','villager','villager','villager','villager']);assert.equal(father.action(0,[3],{infect:true}),null);father.tick();assert.equal(father.p(3).role,'wolf');assert.equal(father.p(0).infectionUsed,true);
 father.step('wolves');assert.match(father.action(0,[4],{infect:true}),/khả năng/);
 const cub=fixture(['wolf','wolfcub','villager','villager','villager','villager','villager']);cub.g.phase='vote';cub.g.until=10000;cub.g.votes=Object.fromEntries(cub.g.players.map(p=>[p.id,'p1']));cub.tick();assert.equal(cub.g.night.slots,2);assert.equal(cub.g.phase,'night');
});

test('hunter gets a private shot; Cupid deaths chain; cross-team lovers can win together',()=>{
 const f=fixture(['wolf','hunter','cupid','villager','villager','villager']);f.action(0,[1]);f.tick();assert.equal(f.g.phase,'hunter');assert.equal(privateWerewolf(f.room,'p1').hunter,true);assert.match(f.action(2,[0]),/thao tác|Chưa/);assert.equal(f.action(1,[0]),null);assert.equal(f.p(0).alive,false);assert.equal(f.g.winner.team,'village');
 const lovers=fixture(['wolf','cupid','villager','villager','villager','villager']);lovers.step('cupid');assert.equal(lovers.action(1,[2,3]),null);lovers.step('wolves');lovers.action(0,[2]);lovers.tick();assert.equal(lovers.p(2).alive,false);assert.equal(lovers.p(3).alive,false);
 const cross=fixture(['wolf','cupid','villager','villager','villager']);cross.g.lovers=['p0','p2'];cross.p(1).alive=cross.p(3).alive=false;cross.p(4).alive=false;cross.tick();assert.equal(cross.g.winner.team,'lovers');
});

test('knight revenge is delayed one night and wild child follows their fallen idol',()=>{
 const f=fixture(['wolf','knight','wildchild','villager','villager','villager','villager']);f.step('wildchild');assert.equal(f.action(2,[3]),null);
 f.step('wolves');f.action(0,[1]);f.tick();assert.equal(f.p(0).alive,true);assert.equal(f.g.delayed[0].id,'p0');
 f.g.day=2;f.step('wolves');f.action(0,[3]);f.tick();assert.equal(f.p(0).alive,false);assert.equal(f.p(2).role,'wolf');
});

test('raven adds two votes, old hag blocks a voter, idiot survives only their first elimination, and scapegoat breaks ties',()=>{
 const f=fixture(['wolf','raven','oldhag','idiot','scapegoat','villager','villager','villager']);
 f.step('raven');f.action(1,[5]);assert.equal(f.g.night.marked,'p5');f.step('oldhag');f.action(2,[6]);f.g.phase='vote';assert.match(f.send(6,'ww-vote',{target:'p0'}),/quyền/);
 f.g.votes={p0:'p3',p1:'p3',p2:'p3',p3:'p3',p4:null,p5:null,p7:null};f.tick();assert.equal(f.p(3).alive,true);assert.equal(f.p(3).idiotExposed,true);
 f.g.phase='vote';f.g.until=20000;f.g.votes=Object.fromEntries(f.g.players.filter(p=>p.alive).map(p=>[p.id,'p3']));f.tick();assert.equal(f.p(3).alive,false);
 const tie=fixture(['wolf','scapegoat','villager','villager','villager','villager']);tie.g.phase='vote';tie.g.votes={p0:'p2',p1:'p2',p2:'p3',p3:'p3',p4:null,p5:null};tie.tick();assert.equal(tie.p(1).alive,false);
 const raven=fixture(['wolf','raven','villager','villager','villager']);raven.g.phase='vote';raven.g.night.marked='p3';raven.g.votes={p0:'p3',p1:'p3',p2:'p0',p3:'p0',p4:null};raven.tick();assert.equal(raven.p(3).alive,false);
});

test('minion and sisters get only their permitted teammates; village-looking minion is not a wolf to seer',()=>{
 const f=fixture(['wolf','minion','sisters','sisters','seer','villager','villager']);assert.deepEqual(privateWerewolf(f.room,'p1').teammates,['p0']);assert.deepEqual(privateWerewolf(f.room,'p0').teammates,['p0']);assert.deepEqual(privateWerewolf(f.room,'p2').teammates,['p2','p3']);
 f.step('seer');f.action(4,[1]);assert.equal(f.p(4).vision.result,'village');
});

test('white wolf, serial killer, piper and tanner have separate win paths',()=>{
 const f=fixture(['wolf','whitewolf','serial','piper','tanner','villager','villager']);
 f.step('whitewolf');assert.equal(f.action(1,[0]),null);f.tick();assert.equal(f.p(0).alive,false);
 const serial=fixture(['wolf','serial','villager','villager','villager']);serial.action(0,[1]);serial.tick();assert.equal(serial.p(1).alive,true);serial.step('serial');serial.action(1,[2]);serial.tick();assert.equal(serial.p(2).alive,false);
 serial.p(3).alive=serial.p(4).alive=false;serial.g.until=30000;serial.g.phase='vote';serial.g.votes={p0:null,p1:null};serial.tick();assert.equal(serial.g.winner?.team,'solo');
 const piper=fixture(['wolf','piper','villager','villager','villager']);piper.g.charmed=['p0','p2'];piper.step('piper');assert.equal(piper.action(1,[3,4]),null);piper.tick();assert.equal(piper.g.winner.team,'piper');
 const tanner=fixture(['wolf','tanner','villager','villager','villager']);tanner.g.phase='vote';tanner.g.votes=Object.fromEntries(tanner.g.players.map(p=>[p.id,'p1']));tanner.tick();assert.equal(tanner.g.winner.team,'tanner');
});

test('private chat and voice isolate wolves, spectators and living players through all phases',()=>{
 const f=fixture(['wolf','wolf','seer','villager','villager','villager','villager']);f.p(5).alive=false;f.p(5).role='wolf';
 assert.equal(chatChannel(f.room,'p0'),'wolves');assert.equal(chatChannel(f.room,'p2'),null);assert.equal(chatChannel(f.room,'p5'),'spectators');
 const entry={gameId:f.g.id,channel:'wolves',text:'secret'};assert.equal(readWerewolfChat(f.room,'p1',[entry]).length,1);assert.equal(readWerewolfChat(f.room,'p2',[entry]).length,0);assert.equal(readWerewolfChat(f.room,'p5',[entry]).length,0);
 assert.equal(werewolfVoice(f.room,'p0'),null);const grave=werewolfVoice(f.room,'p5');assert.deepEqual(grave.members,['p5']);
 f.g.phase='day';const living=werewolfVoice(f.room,'p0');assert.ok(!living.members.includes('p5'));assert.notEqual(living.key,grave.key);
 const msg={type:'chat',text:'spectator secret',clientId:'message-12345'};const output=applyMessage(f.room,'p5','s5',msg,3000);assert.ok(output.events.every(e=>e.to==='p5'));
 const state=snapshot(f.room,3000,'p2');assert.ok(!JSON.stringify(state).includes('spectator secret'));
 const malicious=applyMessage(f.room,'p2','s2',{type:'voice-session',key:grave.key},3000);assert.equal(malicious.voice,null);
 const before=werewolfVoice(f.room,'p1').key;leaveWerewolf(f.room,'p3',4000);assert.equal(f.g.phase,'day');assert.notEqual(werewolfVoice(f.room,'p1').key,before,'a death rotates the live voice room even during daytime');
 assert.equal(privateWerewolf(f.room,'p5').wolfChoices,null,'dead wolves must not receive future pack choices');assert.equal(privateWerewolf(f.room,'p2').wolfSlots,undefined);
});

test('mode changes cannot abandon an active game; disconnected players lose their seat only after grace',()=>{
 const f=fixture();const denied=applyMessage(f.room,'p0','s0',{type:'room-mode',mode:'movie',hostVersion:f.room.hostVersion},3000);assert.equal(denied.controlResult.accepted,false);
 disconnectMember(f.room,'p3','s3',3000);assert.equal(f.p(3).alive,true);leaveWerewolf(f.room,'p3',50000);assert.equal(f.p(3).alive,false);
 f.send(0,'ww-end');assert.equal(f.g.phase,'ended');const result=applyMessage(f.room,'p0','s0',{type:'room-mode',mode:'karaoke',hostVersion:f.room.hostVersion},4000);assert.equal(result.controlResult.accepted,true);assert.equal(f.room.mode,'karaoke');
});
