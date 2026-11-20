import {WW_ROLES,WW_WOLVES,WW_STEPS} from './werewolf-rules.js';

export function createWerewolfUI({getId,sendControl,now,notice,onTarget}){
 const $=selector=>document.querySelector(selector);let state={},online=false,chosen=[],lastVersion='',settingsDirty=false,signature='';
 const roleText=role=>role?WW_ROLES[role][1]+' '+WW_ROLES[role][0]:'Người xem';
 function send(type,extra={}){const g=state.werewolf;if(!g||!online)return notice('Đang chờ kết nối phòng.');return sendControl({type,gameId:g.id,version:g.version,...extra});}
 $('#mode-werewolf').onclick=()=>sendControl({type:'room-mode',mode:'werewolf',hostVersion:state.hostVersion});
 $('#ww-join').onclick=()=>send('ww-join',{join:!state.werewolf?.players.some(p=>p.id===getId())});
 $('#ww-ready').onclick=()=>send('ww-ready',{ready:!state.werewolf?.players.find(p=>p.id===getId())?.ready});
 $('#ww-start').onclick=()=>send('ww-start');$('#ww-next-day').onclick=()=>send('ww-discuss-end');$('#ww-new').onclick=()=>send('ww-new');
 $('#ww-end').onclick=()=>$('#ww-end-dialog').showModal();$('#ww-end-cancel').onclick=()=>$('#ww-end-dialog').close();$('#ww-end-confirm').onclick=()=>{send('ww-end');$('#ww-end-dialog').close();};
 $('#ww-role-open').onclick=()=>$('#ww-role-dialog').showModal();$('#ww-role-close').onclick=()=>$('#ww-role-dialog').close();
 $('#ww-board-open').onclick=()=>{if(!$('#drawer').hidden)$('#close').click();$('#ww-board').hidden=!$('#ww-board').hidden;$('#ww-board-open').setAttribute('aria-expanded',String(!$('#ww-board').hidden));};
 const roleInputs=new Map();
 for(const [id,[name,icon,team,description]] of Object.entries(WW_ROLES)){
  const row=document.createElement('label');row.className='ww-role-option';const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=['seer','guard'].includes(id);input.disabled=['wolf','villager'].includes(id);if(input.disabled)input.checked=true;
  const text=document.createElement('span'),title=document.createElement('strong'),desc=document.createElement('small');title.textContent=icon+' '+name+' · '+team;desc.textContent=description;text.append(title,desc);row.append(input,text);$('#ww-settings-roles').append(row);if(!input.disabled)roleInputs.set(id,input);input.onchange=()=>settingsDirty=true;
 }
 $('#ww-all-roles').onclick=()=>{for(const input of roleInputs.values())input.checked=true;settingsDirty=true;};
 $('#ww-basic-roles').onclick=()=>{for(const [id,input] of roleInputs)input.checked=['seer','guard'].includes(id);settingsDirty=true;};
 for(const name of ['discussion','night','action','vote','reveal'])$('#ww-setting-'+name).onchange=()=>settingsDirty=true;
 $('#ww-settings-save').onclick=()=>{const settings={roles:[...roleInputs].filter(([,input])=>input.checked).map(([id])=>id)};for(const name of ['discussion','night','action','vote'])settings[name]=Number($('#ww-setting-'+name).value);settings.reveal=$('#ww-setting-reveal').checked;send('ww-settings',{settings});settingsDirty=false;};
 function pick(id){if(!state.werewolf?.players.find(p=>p.id===id)?.alive)return;const max=selectionLimit();if(chosen.includes(id))chosen=chosen.filter(value=>value!==id);else chosen=max===1?[id]:[...chosen,id].slice(-max);draw(true);onTarget?.(chosen);}
 window.addEventListener('werewolf-target',event=>{if(state.mode==='werewolf'){if(!$('#drawer').hidden)$('#close').click();pick(event.detail);$('#ww-board').hidden=false;$('#ww-board-open').setAttribute('aria-expanded','true');}});
 function selectionLimit(){const g=state.werewolf;if(g?.phase==='night'&&['cupid','detective','piper'].includes(g.step))return 2;if(g?.step==='wolves'&&g.phase==='night')return state.wwPrivate?.wolfSlots||1;return 1;}
 $('#ww-confirm').onclick=()=>{const g=state.werewolf;if(g.phase==='vote')send('ww-vote',{target:chosen[0]??null});else send('ww-action',{targets:chosen,use:$('#ww-witch-use').value,infect:$('#ww-infect').checked});};
 $('#ww-skip').onclick=()=>{const g=state.werewolf;if(g.phase==='vote')send('ww-vote',{target:null});else send('ww-action',{targets:[],use:'skip'});};
 function draw(force=false){
  const g=state.werewolf,active=state.mode==='werewolf',mine=state.hostId===getId(),priv=state.wwPrivate||{};
  $('#ww-hud').hidden=!active;$('#ww-panel').hidden=!active;document.body.classList.toggle('werewolf-mode',active);
  $('#mode-werewolf').disabled=!online||!mine||active||state.pendingMode==='werewolf';
  if(!active||!g){$('#ww-board').hidden=true;return;}
  const me=g.players.find(p=>p.id===getId()),lobby=g.phase==='lobby',ended=g.phase==='ended',acting=priv.hunter||g.phase==='night'&&(!priv.action||g.step==='wolves')&&(g.step==='wolves'?WW_WOLVES.has(priv.role):priv.role===g.step),vote=g.phase==='vote'&&me?.alive&&g.silenced!==getId()&&!(me.role==='idiot');
  const role=priv.role?WW_ROLES[priv.role]:null;
  $('#ww-phase').textContent=lobby?'🐺 Phòng chờ Ma Sói':ended?'🏁 Kết thúc':g.phase==='night'?'🌙 Đêm '+g.day+' · '+(WW_STEPS[g.step]||''):g.phase==='hunter'?'🏹 Thợ săn chọn người':g.phase==='vote'?'🗳️ Ngày '+g.day+' · Bỏ phiếu':'☀️ Ngày '+g.day+' · Thảo luận';
  $('#ww-clock').textContent=g.until?Math.max(0,Math.ceil((g.until-now())/1000))+'s':'';
  $('#ww-role-title').textContent=roleText(priv.role);$('#ww-role-description').textContent=role?.[3]||'Bạn đang xem ván. Tham gia ở phòng chờ để được nhận vai.';
  const known=[];if(priv.changed)known.push(priv.changed);if(priv.teammates?.length)known.push('Đồng đội: '+priv.teammates.map(id=>g.players.find(p=>p.id===id)?.name||'Khách').join(', '));if(priv.lovers?.length)known.push('Cặp đôi: '+priv.lovers.map(id=>g.players.find(p=>p.id===id)?.name).join(' & '));if(priv.idol)known.push('Thần tượng: '+g.players.find(p=>p.id===priv.idol)?.name);if(priv.enchanted)known.push('Bạn đã bị mê hoặc.');
  if(priv.vision)known.push('Kết quả đêm '+priv.vision.day+': '+priv.vision.targets.map(id=>g.players.find(p=>p.id===id)?.name).join(' / ')+' → '+({wolf:'Sói',village:'Dân',same:'cùng phe',different:'khác phe'}[priv.vision.result]));
  $('#ww-role-known').textContent=known.join('\n');
  $('#ww-join').hidden=!lobby;$('#ww-join').textContent=me?'Rời bàn':'Tham gia bàn';$('#ww-join').disabled=!online;
  $('#ww-ready').hidden=!lobby||!me;$('#ww-ready').textContent=me?.ready?'✓ Đã sẵn sàng':'Sẵn sàng';$('#ww-ready').disabled=!online;
  $('#ww-start').hidden=!lobby||!mine;$('#ww-start').disabled=!online||g.players.length<5||g.players.some(p=>!p.ready||!state.users.find(u=>u.id===p.id)?.connected);
  $('#ww-new').hidden=!ended||!mine;$('#ww-end').hidden=lobby||ended||!mine;$('#ww-next-day').hidden=g.phase!=='day'||!mine;
  $('#ww-settings').hidden=!lobby||!mine;
  if(!settingsDirty){for(const [id,input] of roleInputs)input.checked=g.settings.roles.includes(id);for(const name of ['discussion','night','action','vote'])$('#ww-setting-'+name).value=g.settings[name];$('#ww-setting-reveal').checked=g.settings.reveal;}
  $('#ww-winner').textContent=g.winner?.text||'';
  $('#ww-action-help').textContent=lobby?g.players.length+'/20 người. Cần ít nhất 5 người, tất cả bấm Sẵn sàng.':ended?'Xem lại vai và diễn biến. Chủ phòng có thể mở ván mới.':acting?(g.step==='witch'?'Chọn dùng bình cứu, bình độc hoặc bỏ qua.':g.step==='wolves'?'Chọn nạn nhân; bầy có thể đổi lựa chọn trước khi hết giờ.':'Chọn mục tiêu rồi xác nhận.'):vote?'Chọn một người để biểu quyết hoặc chọn phiếu trắng.':me?.alive?'Hãy chờ lượt của mình. Xem kết quả kỹ năng trong Vai của tôi.':'Bạn là khán giả; chat và mic được tách khỏi người còn chơi.';
  $('#ww-confirm').hidden=!acting&&!vote;$('#ww-confirm').disabled=!online||(!chosen.length&&g.step!=='witch');$('#ww-confirm').textContent=vote?'Xác nhận phiếu':'Xác nhận kỹ năng';$('#ww-skip').hidden=!vote&&!priv.hunter&&!(acting&&g.step==='witch');$('#ww-skip').textContent=vote?'Phiếu trắng':'Bỏ qua';
  $('#ww-witch-controls').hidden=!(acting&&g.step==='witch');$('#ww-witch-victim').textContent=priv.victims?.length?'Sói đang nhắm: '+priv.victims.map(id=>g.players.find(p=>p.id===id)?.name).join(', '):'Không có nạn nhân của Sói.';
  $('#ww-infect-label').hidden=!(acting&&priv.role==='wolffather'&&!priv.infectUsed);
  const sig=JSON.stringify([g.players,state.users.map(u=>[u.id,u.connected,u.mic]),chosen,acting,vote,priv.wolfChoices]);if(force||sig!==signature){signature=sig;$('#ww-players').replaceChildren();for(const [index,p] of g.players.entries()){
   const button=document.createElement('button');button.type='button';button.className='ww-player'+(p.alive?'':' eliminated')+(chosen.includes(p.id)?' selected':'');button.setAttribute('aria-pressed',String(chosen.includes(p.id)));button.disabled=(!acting&&!vote)||!p.alive;
   const user=state.users.find(u=>u.id===p.id);button.textContent=(index+1)+'. '+p.name+(p.id===getId()?' (bạn)':'')+(p.role?' · '+roleText(p.role):'')+(lobby?(p.ready?' ✓':' · Chưa sẵn sàng'):!p.alive?' · Đã loại':'')+(!user?.connected?' · Mất kết nối':user.mic?' 🎙':'')+(g.voted.includes(p.id)?' · Đã bầu':'');
   button.onclick=()=>pick(p.id);$('#ww-players').append(button);
  }}
  $('#ww-log').replaceChildren();for(const item of g.log.slice(-10).reverse()){const line=document.createElement('p');line.textContent=item.text;$('#ww-log').append(line);}
  $('#ww-counts').textContent=Object.entries(g.counts||{}).map(([role,count])=>count+' '+WW_ROLES[role][0]).join(' · ');
  $('#ww-chat-channel').textContent=priv.chatChannel==='wolves'?'Chat riêng bầy Sói':priv.chatChannel==='spectators'?'Chat khán giả':priv.chatChannel?'Chat cả bàn':'Ban đêm: chat đang khóa';
  if(priv.wolfChoices)$('#ww-team-choice').textContent='Bầy đang chọn: '+Object.entries(priv.wolfChoices).filter(([,targets])=>targets.length).map(([id,targets])=>(g.players.find(p=>p.id===id)?.name||'Sói')+' → '+targets.map(target=>g.players.find(p=>p.id===target)?.name).join(', ')).join('; ');else $('#ww-team-choice').textContent='';
 }
 return {render(next){const entering=next.mode==='werewolf'&&(state.mode!=='werewolf'||state.werewolf?.id!==next.werewolf?.id);state=next;if(entering){$('#ww-board').hidden=false;$('#ww-board-open').setAttribute('aria-expanded','true');}const version=next.werewolf?.id+':'+next.werewolf?.version;if(version!==lastVersion){chosen=[];$('#ww-infect').checked=false;$('#ww-witch-use').value='skip';lastVersion=version;}draw();},connected(value){online=value;draw();},tick(){const g=state.werewolf;$('#ww-clock').textContent=g?.until?Math.max(0,Math.ceil((g.until-now())/1000))+'s':'';}};
}
