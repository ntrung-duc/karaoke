export function createRoomHost({getId,sendControl,notice}){
 const $=selector=>document.querySelector(selector),people=$('#people'),status=$('#host-status'),dialog=$('#host-dialog'),confirm=$('#host-confirm');
 let state={},online=false,target=null,pending=null,timer,signature='';
 function close(){if(dialog.open)dialog.close();target=null;}
 $('#host-cancel').onclick=close;
 function draw(){
  const id=getId(),users=state.users||[],host=users.find(user=>user.id===state.hostId),mine=state.hostId===id;
  status.textContent=!online?'Đang cập nhật quyền chủ phòng…':host?(mine?'👑 Bạn là chủ phòng.':'👑 Chủ phòng: '+host.name)+(state.hostReconnectUntil?' Đang chờ kết nối lại (tối đa 45 giây).':''):'Chưa có chủ phòng đang kết nối.';
  confirm.disabled=!online||!!pending||!target;
  const next=JSON.stringify([id,online,pending,state.hostId,users.map(user=>[user.id,user.name,user.mic,user.seat,user.connected]),state.song?.owner]);
  if(next===signature)return;signature=next;
  const fragment=document.createDocumentFragment();
  for(const user of users){
   const row=document.createElement('div');row.className='person-row';
   const label=document.createElement('span');
   label.textContent=(user.id===state.hostId?'👑 ':user.mic?'🎙 ':'● ')+user.name+(user.id===id?' (bạn)':'')+(user.connected===false?' · Mất kết nối':user.id===state.song?.owner?' · Trên sân khấu':user.seat>=0?' · Ghế '+(user.seat+1):' · Đang đứng');
   row.append(label);
   if(mine&&user.id!==id&&user.connected){
    const button=document.createElement('button');button.type='button';button.textContent='Trao quyền';button.setAttribute('aria-label','Trao quyền chủ phòng cho '+user.name);button.disabled=!online||!!pending;
    button.onclick=()=>{
     target={id:user.id,version:state.hostVersion};
     $('#host-recipient').textContent=user.name;
     confirm.disabled=false;dialog.showModal();$('#host-cancel').focus();
    };row.append(button);
   }
   fragment.append(row);
  }
  people.replaceChildren(fragment);
 }
 confirm.onclick=()=>{
  if(!online||pending||!target)return;
  const requestId=sendControl({type:'transfer-host',target:target.id,hostVersion:target.version});
  if(!requestId)return;
  pending=requestId;draw();
  timer=setTimeout(()=>{pending=null;draw();},11000);
 };
 dialog.addEventListener('close',()=>{target=null;});
 return {
  connected(value){online=value;if(!value){clearTimeout(timer);pending=null;close();}draw();},
  render(value){state=value;if(target&&(state.hostId!==getId()||target.version!==state.hostVersion||!state.users.some(user=>user.id===target.id&&user.connected)))close();draw();},
  receive(message){if(message.requestId!==pending)return;clearTimeout(timer);pending=null;close();draw();if(message.accepted)notice('Đã trao quyền chủ phòng.');}
 };
}
