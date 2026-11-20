import {randomUUID,randomInt} from 'node:crypto';
import {WW_ROLES,WW_WOLVES,WW_STEPS,WW_DEFAULTS} from '../public/werewolf-rules.js';

const live=g=>g.players.filter(p=>p.alive),wolf=p=>WW_WOLVES.has(p.role),player=(g,id)=>g.players.find(p=>p.id===id);
const running=g=>g&&!['lobby','ended'].includes(g.phase);
export const isWerewolfRunning=room=>room.mode==='werewolf'&&running(room.werewolf);
export function createWerewolf(){return {id:randomUUID(),version:0,phase:'lobby',day:0,step:null,until:null,players:[],settings:{...WW_DEFAULTS,roles:[...WW_DEFAULTS.roles]},log:[],actions:{},votes:{},hunters:[],night:{},charmed:[],lovers:[],lastGuard:null,lastHag:null,cubBoost:false,winner:null,voiceRevision:0};}
function log(g,text){g.log.push({day:g.day,text});g.log=g.log.slice(-60);}
function phase(room,name,now,seconds,step=null){const g=room.werewolf,keepMic=g.phase==='day'&&name==='vote';g.phase=name;g.step=step;g.version++;g.until=seconds?now+seconds*1000:null;if(!keepMic)for(const member of room.users.values())member.data.mic=false;}
function end(room,winner,now){room.werewolf.winner=winner;phase(room,'ended',now,0);log(room.werewolf,'Ván kết thúc. Các vai được công khai.');}
function team(p){return ['serial','whitewolf','piper','tanner'].includes(p.role)?p.role:wolf(p)||p.role==='minion'?'wolf':'village';}
function victory(room,now){
 const g=room.werewolf,alive=live(g);if(g.phase==='ended')return true;
 if(!alive.length){end(room,{team:'draw',ids:[],text:'Không còn ai sống sót.'},now);return true;}
 if(g.lovers.length===2&&g.lovers.every(id=>alive.some(p=>p.id===id))&&alive.length===2&&team(player(g,g.lovers[0]))!==team(player(g,g.lovers[1]))){end(room,{team:'lovers',ids:g.lovers,text:'Cặp đôi khác phe chiến thắng!'},now);return true;}
 const piper=alive.find(p=>p.role==='piper');if(piper&&alive.every(p=>p.id===piper.id||g.charmed.includes(p.id))){end(room,{team:'piper',ids:[piper.id],text:'Kẻ thổi sáo đã mê hoặc cả làng!'},now);return true;}
 const solo=alive.filter(p=>p.role==='serial'&&alive.length<=2||p.role==='whitewolf'&&alive.filter(wolf).length===1&&alive.length<=2);
 if(solo.length){end(room,{team:'solo',ids:solo.map(p=>p.id),text:solo.map(p=>WW_ROLES[p.role][0]).join(' và ')+' đạt điều kiện thắng riêng!'},now);return true;}
 if(alive.some(p=>['serial','whitewolf'].includes(p.role)))return false;
 const wolves=alive.filter(wolf);if(!wolves.length){end(room,{team:'village',ids:g.players.filter(p=>team(p)==='village').map(p=>p.id),text:'Phe Dân làng chiến thắng!'},now);return true;}
 if(wolves.length>=alive.length-wolves.length){end(room,{team:'wolf',ids:g.players.filter(p=>team(p)==='wolf').map(p=>p.id),text:'Phe Sói chiến thắng!'},now);return true;}return false;
}
function kill(room,id,cause){
 const g=room.werewolf,p=player(g,id);if(!p?.alive)return;p.alive=false;p.death=cause;g.voiceRevision=(g.voiceRevision||0)+1;room.users.get(id)&&(room.users.get(id).data.mic=false);log(g,p.name+' đã bị loại'+(cause==='left'?' vì rời phòng quá lâu.':'.'));
 if(p.role==='hunter')g.hunters.push(id);if(p.role==='wolfcub')g.cubBoost=true;
 if(p.role==='knight'&&cause==='wolf'){
  const attacker=live(g).find(q=>wolf(q)&&(g.actions[q.id]?.targets||[]).includes(id));if(attacker)(g.delayed??=[]).push({id:attacker.id,night:g.day+1});
 }
 for(const other of live(g)){if(other.role==='apprentice'&&p.role==='seer'){other.role='seer';other.changed='Tiên tri đã mất; bạn trở thành Tiên tri.';}if(other.role==='wildchild'&&other.idol===id){other.role='wolf';other.changed='Thần tượng đã mất; bạn trở thành Sói.';}}
 if(g.lovers.includes(id))for(const lover of g.lovers)if(lover!==id)kill(room,lover,'love');
}
function startDay(room,now){const g=room.werewolf;log(g,'Ngày '+g.day+': bắt đầu thảo luận.');phase(room,'day',now,g.settings.discussion);}
function continueAfterDeaths(room,now,next){
 const g=room.werewolf;
 if(g.hunters.length){g.afterHunters=next;phase(room,'hunter',now,g.settings.action);return;}
 if(victory(room,now))return;
 if(next==='day')startDay(room,now);else if(next==='night')startNight(room,now);else if(next){phase(room,next.phase,now,next.seconds,next.step);}
}
function resolveNight(room,now){
 const g=room.werewolf,n=g.night,choices={};
 for(const p of live(g).filter(wolf))for(const target of g.actions[p.id]?.targets||[])choices[target]=(choices[target]||0)+1;
 const attacked=n.attacked||wolfTargets(g);
 const father=live(g).find(p=>p.role==='wolffather'&&g.actions[p.id]?.infect&&!p.infectionUsed);
 const deaths=[];
 for(const id of attacked){const p=player(g,id);if(!p?.alive||id===n.protected||id===n.saved)continue;
  if(p.role==='serial')continue;
  if(p.role==='cursed'||father&&id===attacked[0]){p.role='wolf';p.changed='Bạn đã biến thành Sói.';if(father&&id===attacked[0])father.infectionUsed=true;continue;}
  if(p.role==='elder'&&!p.elderHit){p.elderHit=true;continue;}deaths.push([id,'wolf']);
 }
 for(const p of live(g))if(['serial','whitewolf'].includes(p.role)){const id=g.actions[p.id]?.targets?.[0];if(id&&id!==n.protected&&id!==n.saved)deaths.push([id,'night']);}
 if(n.poisoned)deaths.push([n.poisoned,'poison']);
 for(const item of g.delayed||[])if(item.night<=g.day)deaths.push([item.id,'knight']);g.delayed=(g.delayed||[]).filter(item=>item.night>g.day);
 const before=live(g).length;for(const [id,cause] of deaths)kill(room,id,cause);if(live(g).length===before)log(g,'Đêm qua không có ai bị loại.');
 continueAfterDeaths(room,now,'day');
}
function advanceNight(room,now){
 const g=room.werewolf,index=g.steps.indexOf(g.step),step=g.steps[index+1];
 if(g.step==='wolves'){
  const counts={};for(const p of live(g).filter(wolf))for(const target of g.actions[p.id]?.targets||[])counts[target]=(counts[target]||0)+1;
  g.night.attacked=Object.keys(counts).map(id=>({id,votes:counts[id],tie:randomInt(0x1000000)})).sort((a,b)=>b.votes-a.votes||a.tie-b.tie).slice(0,g.night.slots).map(item=>item.id);
 }
 if(!step){resolveNight(room,now);return;}
 phase(room,'night',now,step==='wolves'?g.settings.night:g.settings.action,step);
}
function startNight(room,now){
 const g=room.werewolf;g.day++;g.actions={};g.votes={};g.night={slots:g.cubBoost?2:1};g.cubBoost=false;
 const roles=new Set(g.players.map(p=>p.role));g.steps=Object.keys(WW_STEPS).filter(step=>step==='wolves'||roles.has(step)).filter(step=>!['cupid','wildchild'].includes(step)||g.day===1).filter(step=>step!=='whitewolf'||g.day%2===0);
 phase(room,'night',now,g.steps[0]==='wolves'?g.settings.night:g.settings.action,g.steps[0]);log(g,'Đêm '+g.day+' bắt đầu.');
}
function resolveVote(room,now){
 const g=room.werewolf,counts={},blank=Object.values(g.votes).filter(v=>v===null).length+live(g).filter(p=>!p.idiotExposed&&p.id!==g.night.silenced&&!(p.id in g.votes)).length;
 for(const id of Object.values(g.votes))if(id&&player(g,id)?.alive)counts[id]=(counts[id]||0)+1;
 if(player(g,g.night.marked)?.alive)counts[g.night.marked]=(counts[g.night.marked]||0)+2;
 const max=Math.max(0,...Object.values(counts)),top=Object.keys(counts).filter(id=>counts[id]===max);
 let target=top.length===1&&max>blank?player(g,top[0]):null;
 if(!target&&max>0&&(top.length>1||max===blank))target=live(g).find(p=>p.role==='scapegoat');
 if(!target){log(g,'Biểu quyết không loại ai.');if(!victory(room,now))startNight(room,now);return;}
 if(target.role==='idiot'&&!target.idiotExposed&&target.id!==live(g).find(p=>p.role==='scapegoat')?.id){target.idiotExposed=true;log(g,target.name+' lộ vai Kẻ ngốc và mất quyền bầu.');startNight(room,now);return;}
 kill(room,target.id,'vote');if(target.role==='tanner'){end(room,{team:'tanner',ids:[target.id],text:'Kẻ chán đời thắng vì bị biểu quyết loại!'},now);return;}
 continueAfterDeaths(room,now,'night');
}
export function tickWerewolf(room,now){
 const g=room.werewolf;if(room.mode!=='werewolf'||!running(g)||!g.until||g.until>now)return false;
 if(g.phase==='night')advanceNight(room,now);
 else if(g.phase==='day')phase(room,'vote',now,g.settings.vote);
 else if(g.phase==='vote')resolveVote(room,now);
 else if(g.phase==='hunter'){g.hunters.shift();continueAfterDeaths(room,now,g.afterHunters);}
 return true;
}
export function leaveWerewolf(room,id,now){
 const g=room.werewolf;if(room.mode!=='werewolf'||!g)return;
 if(g.phase==='lobby'){g.players=g.players.filter(p=>p.id!==id);return;}
 if(running(g)&&player(g,id)?.alive){const next={phase:g.phase,step:g.step,seconds:Math.max(1,Math.ceil((g.until-now)/1000))};kill(room,id,'left');if(g.phase!=='hunter')continueAfterDeaths(room,now,next);}
}
export function publicWerewolf(room){
 const g=room.werewolf;if(room.mode!=='werewolf'||!g)return null;
 const counts={};if(g.phase!=='lobby')for(const role of g.initialRoles||[])counts[role]=(counts[role]||0)+1;
 return {id:g.id,version:g.version,phase:g.phase,step:g.step,day:g.day,until:g.until,settings:g.settings,counts,players:g.players.map(p=>({id:p.id,name:p.name,animal:p.animal,ready:!!p.ready,alive:p.alive,role:g.phase==='ended'||!p.alive&&g.settings.reveal||p.idiotExposed?p.role:undefined})),log:g.log,winner:g.winner,voted:Object.keys(g.votes||{}),marked:g.phase==='day'||g.phase==='vote'?g.night.marked:null,silenced:g.phase==='day'||g.phase==='vote'?g.night.silenced:null};
}
export function werewolfVoice(room,id){
 const g=room.werewolf;if(room.mode!=='werewolf'||!g||!room.users.has(id))return null;
 const p=player(g,id),spectator=running(g)&&!p?.alive;
 const group=['lobby','ended'].includes(g.phase)?'all':spectator?'spectators':['day','vote'].includes(g.phase)?'day-'+g.day+'-'+(g.voiceRevision||0):null;
 if(!group)return null;
 const members=[...room.users.keys()].filter(other=>{const q=player(g,other);return group==='all'||group==='spectators'?!running(g)||!q?.alive:!!q?.alive;});
 return {key:g.id+'-'+group,group:true,namespace:'werewolf',members};
}
export function chatChannel(room,id){
 const g=room.werewolf;if(room.mode!=='werewolf'||!g||['lobby','ended'].includes(g.phase))return 'public';
 const p=player(g,id);if(!p?.alive)return 'spectators';if(g.phase==='night'&&wolf(p))return 'wolves';if(['day','vote'].includes(g.phase))return 'day';return null;
}
export function readWerewolfChat(room,id,entries){
 if(room.mode!=='werewolf')return entries.filter(e=>!e.gameId);
 const g=room.werewolf;if(!id||!g)return [];
 const own=chatChannel(room,id),p=player(g,id);
 return entries.filter(e=>e.gameId===g.id&&(g.phase==='ended'||e.channel===own||!p?.alive&&e.channel==='day')).slice(-10);
}
export function privateWerewolf(room,id){
 const g=room.werewolf;if(room.mode!=='werewolf'||!g)return null;const p=player(g,id);
 return {wolfSlots:p?.alive&&wolf(p)?g.night.slots||1:undefined,role:p?.role||null,changed:p?.changed||null,vision:p?.vision||null,teammates:p&&(wolf(p)||p.role==='minion')?g.players.filter(wolf).map(q=>q.id):p?.role==='sisters'?g.players.filter(q=>q.role==='sisters').map(q=>q.id):[],lovers:g.lovers.includes(id)?g.lovers:[],enchanted:g.charmed.includes(id),charmed:p?.role==='piper'?g.charmed:[],idol:p?.idol,action:g.actions[id]||null,infectUsed:!!p?.infectionUsed,healUsed:!!p?.healUsed,poisonUsed:!!p?.poisonUsed,lastGuard:p?.role==='guard'?g.lastGuard:undefined,lastHag:p?.role==='oldhag'?g.lastHag:undefined,victims:p?.role==='witch'&&g.step==='witch'?wolfTargets(g):[],victim:p?.role==='witch'&&g.step==='witch'?wolfTargets(g)[0]||null:null,wolfChoices:p?.alive&&wolf(p)?Object.fromEntries(live(g).filter(wolf).map(q=>[q.id,g.actions[q.id]?.targets||[]])):null,hunter:g.phase==='hunter'&&g.hunters[0]===id,voice:werewolfVoice(room,id),chatChannel:chatChannel(room,id)};
}
function wolfTargets(g){if(g.night.attacked)return g.night.attacked;const counts={};for(const p of live(g).filter(wolf))for(const id of g.actions[p.id]?.targets||[])counts[id]=(counts[id]||0)+1;return Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||g.players.findIndex(p=>p.id===a)-g.players.findIndex(p=>p.id===b)).slice(0,g.night.slots);}
export function werewolfCommand(room,id,message,now,rng=randomInt){
 const g=room.werewolf;if(room.mode!=='werewolf'||!g||message.gameId!==g.id)return 'Ván đã thay đổi. Hãy mở lại Ma Sói.';
 const host=room.hostId===id,p=player(g,id);
 if(message.type==='ww-join'){
  if(g.phase!=='lobby')return 'Ván đã bắt đầu. Bạn có thể xem và chờ ván sau.';
  if(message.join===false)g.players=g.players.filter(q=>q.id!==id);
  else if(!p){if(g.players.length>=20)return 'Bàn đã đủ 20 người.';const data=room.users.get(id).data;g.players.push({id,name:data.name,animal:data.animal,ready:false,alive:true});}return null;
 }
 if(message.type==='ww-ready'){if(g.phase!=='lobby'||!p)return 'Hãy tham gia bàn trước.';p.ready=!!message.ready;return null;}
 if(message.type==='ww-settings'){
  if(!host||g.phase!=='lobby')return 'Chỉ chủ phòng được chỉnh luật trước ván.';
  const s=message.settings;if(!s||!Array.isArray(s.roles)||s.roles.some(role=>!WW_ROLES[role]||['wolf','villager'].includes(role))||!['discussion','night','action','vote'].every(key=>Number.isInteger(s[key])&&s[key]>=10&&s[key]<=600)||typeof s.reveal!=='boolean')return 'Cài đặt chưa hợp lệ.';
  g.settings={...g.settings,...s,roles:[...new Set(s.roles)]};return null;
 }
 if(message.type==='ww-end'){if(!host)return 'Chỉ chủ phòng được kết thúc ván.';end(room,{team:'canceled',ids:[],text:'Chủ phòng đã kết thúc ván.'},now);return null;}
 if(message.type==='ww-new'){if(!host||g.phase!=='ended')return 'Chờ kết thúc ván trước.';const next=createWerewolf();next.settings=g.settings;room.werewolf=next;return null;}
 if(message.type==='ww-start'){
  if(!host||g.phase!=='lobby')return 'Chỉ chủ phòng được bắt đầu ván.';
  if(g.players.length<5||g.players.some(q=>!q.ready||!room.users.get(q.id)?.connectionId))return 'Cần 5–20 người, tất cả sẵn sàng và đang kết nối.';
  const n=g.players.length,wolves=Math.max(1,Math.floor(n/4)),selected=g.settings.roles;
  const variants=selected.filter(role=>WW_WOLVES.has(role)),specials=selected.filter(role=>!WW_WOLVES.has(role)),roles=[];
  for(let i=0;i<wolves;i++)roles.push(variants[i]||'wolf');
  // Prioritize basic support, then randomly select additional roles that fit.
  const order=[...specials.filter(role=>['seer','guard'].includes(role)),...specials.filter(role=>!['seer','guard'].includes(role)).sort(()=>0)];
  for(let i=order.length-1;i>2;i--){const j=2+rng(i-1);[order[i],order[j]]=[order[j],order[i]];}
  for(const role of order){const count=role==='sisters'?2:1;if(roles.length+count>n-1)continue;for(let i=0;i<count;i++)roles.push(role);}
  while(roles.length<n)roles.push('villager');g.initialRoles=[...roles];
  for(let i=roles.length-1;i>0;i--){const j=rng(i+1);[roles[i],roles[j]]=[roles[j],roles[i]];}
  g.players.forEach((q,i)=>{q.role=roles[i];q.alive=true;});startNight(room,now);return null;
 }
 if(!running(g)||message.version!==g.version)return 'Lượt đã thay đổi. Hãy chọn lại.';
 if(message.type==='ww-discuss-end'){if(!host||g.phase!=='day')return 'Chỉ chủ phòng được chuyển sang bỏ phiếu trong ban ngày.';phase(room,'vote',now,g.settings.vote);return null;}
 if(!p?.alive&&!(g.phase==='hunter'&&g.hunters[0]===id))return 'Bạn đang xem ván, không thể thực hiện hành động.';
 if(message.type==='ww-vote'){
  if(g.phase!=='vote'||p.idiotExposed||g.night.silenced===id)return 'Bạn không có quyền bỏ phiếu trong lượt này.';
  if(message.target!==null&&!player(g,message.target)?.alive)return 'Mục tiêu không hợp lệ.';g.votes[id]=message.target;return null;
 }
 if(message.type!=='ww-action')return 'Thao tác chưa được hỗ trợ.';
 const targets=Array.isArray(message.targets)?[...new Set(message.targets)]:[];
 if(targets.length>2||targets.some(target=>typeof target!=='string'||!player(g,target)?.alive))return 'Chọn người còn sống.';
 if(g.phase==='hunter'){
  if(g.hunters[0]!==id||targets.length>1)return 'Chưa đến lượt bắn của bạn.';g.hunters.shift();if(targets[0])kill(room,targets[0],'hunter');continueAfterDeaths(room,now,g.afterHunters);return null;
 }
 if(g.phase!=='night'||!(g.step==='wolves'?wolf(p):p.role===g.step))return 'Chưa đến lượt vai của bạn.';
 if(g.actions[id]&&g.step!=='wolves')return 'Bạn đã xác nhận kỹ năng đêm nay.';
 const step=g.step,need=['cupid','detective'].includes(step)?2:1;
 if(step==='witch'){
  const use=message.use;if(!['skip','heal','poison'].includes(use))return 'Chọn cứu, độc hoặc bỏ qua.';
  if(use==='heal'){const victims=wolfTargets(g),victim=targets[0]||victims[0];if(p.healUsed||!victim||victim===id||!victims.includes(victim)||targets.length>1)return 'Không thể dùng bình cứu lúc này.';p.healUsed=true;g.night.saved=victim;}
  if(use==='poison'){if(p.poisonUsed||targets.length!==1)return 'Không thể dùng bình độc lúc này.';p.poisonUsed=true;g.night.poisoned=targets[0];}
  g.actions[id]={targets,use};return null;
 }
 if(step==='piper'){if(targets.length<1||targets.includes(id))return 'Chọn một hoặc hai người khác để mê hoặc.';g.charmed=[...new Set([...g.charmed,...targets])];}
 else if(step==='wolves'){if(!targets.length||targets.length>g.night.slots||targets.some(target=>wolf(player(g,target))))return 'Chọn nạn nhân khác bầy Sói.';if(message.infect&&(p.role!=='wolffather'||p.infectionUsed))return 'Bạn không thể dùng khả năng biến Sói.';}
 else if(targets.length!==need)return 'Hãy chọn '+need+' người.';
 if(step==='guard'){if(targets[0]===g.lastGuard&&g.lastGuardDay===g.day-1)return 'Không thể bảo vệ cùng một người hai đêm liền.';g.lastGuard=targets[0];g.lastGuardDay=g.day;g.night.protected=targets[0];}
 if(step==='oldhag'){if(targets[0]===g.lastHag&&g.lastHagDay===g.day-1)return 'Không thể chọn cùng người hai đêm liền.';g.lastHag=targets[0];g.lastHagDay=g.day;g.night.silenced=targets[0];}
 if(step==='cupid')g.lovers=targets;
 if(step==='wildchild'){if(targets[0]===id)return 'Thần tượng phải là người khác.';p.idol=targets[0];}
 if(step==='seer')p.vision={day:g.day,targets,result:wolf(player(g,targets[0]))||player(g,targets[0]).role==='lycan'?'wolf':'village'};
 if(step==='detective')p.vision={day:g.day,targets,result:team(player(g,targets[0]))===team(player(g,targets[1]))?'same':'different'};
 if(step==='raven')g.night.marked=targets[0];
 if(step==='whitewolf'&&!wolf(player(g,targets[0])))return 'Sói trắng chỉ chọn một Sói khác.';
 if(['whitewolf','serial'].includes(step)&&targets[0]===id)return 'Không thể tự chọn mình.';
 g.actions[id]={targets,infect:!!message.infect};return null;
}
