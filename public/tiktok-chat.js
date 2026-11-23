export function createTikTokChatUI({send,getId,chat,notice}){
 const $=selector=>document.querySelector(selector),form=$('#tiktok-form'),input=$('#tiktok-username'),connect=$('#tiktok-connect'),disconnect=$('#tiktok-disconnect'),status=$('#tiktok-status'),toggle=$('#tiktok-visible');
 let state={},online=false,live={state:'disconnected',username:'',message:'Chưa kết nối TikTok LIVE.'},pending=null,timer;
 try{toggle.checked=localStorage.getItem('rap-tiktok-visible')!=='false';}catch{}
 chat.externalVisible(toggle.checked);
 toggle.onchange=()=>{chat.externalVisible(toggle.checked);try{localStorage.setItem('rap-tiktok-visible',String(toggle.checked));}catch{}};
 function draw(){
  const mine=state.hostId===getId();form.hidden=!mine;
  input.disabled=!online||!!pending;connect.disabled=!online||!!pending||['connecting','reconnecting'].includes(live.state);
  disconnect.disabled=!online||!!pending||live.state==='disconnected';
  status.textContent=!online?'Đang chờ kết nối phòng…':live.message;
  $('#tiktok-host-help').textContent=mine?'Bật LIVE trên TikTok trước, rồi nhập @tên_kênh. Không cần nhập mật khẩu TikTok.':'Chủ phòng có thể kết nối một kênh TikTok LIVE cho cả phòng.';
 }
 function command(type){
  const requestId=crypto.randomUUID();if(!send({type,requestId,username:input.value.trim(),hostVersion:state.hostVersion})){notice('Đang chờ kết nối phòng.');return;}
  pending=requestId;clearTimeout(timer);timer=setTimeout(()=>{pending=null;draw();notice('Chưa nhận được xác nhận TikTok. Thử lại sau.');},10000);draw();
 }
 form.onsubmit=event=>{event.preventDefault();command('tiktok-connect');};disconnect.onclick=()=>command('tiktok-disconnect');draw();
 return {
  render(next){state=next;draw();},
  connected(on){online=on;if(!on){clearTimeout(timer);pending=null;}draw();},
  receive(message){
   if(message.type==='tiktok-status'){const changed=live.username!==message.username;live=message;if(changed)chat.clearExternal();if(message.username&&document.activeElement!==input)input.value='@'+message.username;draw();}
   else if(message.type==='tiktok-chat'){for(const entry of message.entries||[])chat.receiveExternal(entry);}
   else if(message.type==='tiktok-result'&&message.requestId===pending){clearTimeout(timer);pending=null;draw();if(message.error)notice(message.error,6000);}
  },
 };
}
