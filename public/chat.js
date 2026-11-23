import {MAX_CHAT_HISTORY} from './session.js';

export function createChat({send,getId,isOpen,notice}){
 const form=document.querySelector('#chat-form'),input=document.querySelector('#chat-input'),button=form.querySelector('button'),log=document.querySelector('#chat-log'),badge=document.querySelector('#chat-unread');
 let entries=[],external=[],showExternal=true,connected=false,allowed=true,unread=0,lastSent=0;
 function availability(){button.disabled=!connected||!allowed;input.disabled=!allowed;}
 function read(){unread=0;badge.hidden=true;badge.textContent='';}
 function draw(){
  const stick=log.scrollHeight-log.scrollTop-log.clientHeight<70;
  const fragment=document.createDocumentFragment();
  const visible=[...entries,...(showExternal?external:[])].sort((a,b)=>b.at-a.at);
  if(!visible.length){const empty=document.createElement('p');empty.className='dim';empty.textContent='Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!';fragment.append(empty);}
  for(const entry of visible){
   const row=document.createElement('article');row.className='chat-message'+(entry.userId===getId()?' own':'')+(entry.source==='tiktok'?' tiktok-message':'');
   const meta=document.createElement('div');meta.className='chat-meta';const name=document.createElement('strong');name.textContent=(entry.source==='tiktok'?'TikTok · ':'')+entry.name;
   const time=document.createElement('time');time.dateTime=new Date(entry.at).toISOString();time.textContent=new Date(entry.at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
   meta.append(name,time);const text=document.createElement('p');text.textContent=entry.text;row.append(meta,text);fragment.append(row);
  }
  log.replaceChildren(fragment);log.scrollTop=0;
 }
 form.onsubmit=event=>{
  event.preventDefault();const text=input.value.trim();if(!text)return;
  if(!connected||!allowed){notice(allowed?'Đang chờ kết nối chat.':'Chat đang khóa trong lượt này.');return;}
  if(Date.now()-lastSent<750){notice('Chờ một chút rồi gửi tiếp nhé.');return;}
  if(send({type:'chat',text,clientId:crypto.randomUUID()})){lastSent=Date.now();input.value='';notice('');input.focus();}
  else notice('Chưa gửi được tin nhắn. Nội dung vẫn được giữ lại.');
 };
 input.addEventListener('keydown',event=>{if(event.key==='Escape')input.blur();});
 draw();
 return {
  read,
  externalVisible(on){showExternal=on;draw();},
  clearExternal(){external=[];draw();},
  receiveExternal(entry){
   if(entry.source!=='tiktok'||external.some(old=>old.id===entry.id))return;
   external.push(entry);external=external.slice(-MAX_CHAT_HISTORY);if(showExternal)draw();
   if(showExternal&&!isOpen()){unread++;badge.textContent=unread>99?'99+':String(unread);badge.hidden=false;}
  },
  open(){read();log.scrollTop=0;},
  connected(on){connected=on;availability();},
  context(on,placeholder){allowed=on;input.placeholder=placeholder;availability();},
  history(messages){
   const recent=messages.slice(-MAX_CHAT_HISTORY);
   if(entries.length===recent.length&&entries.at(-1)?.id===recent.at(-1)?.id)return;
   entries=recent;draw();
  },
  receive(entry){
   if(entries.some(old=>old.id===entry.id))return;
   entries.push(entry);entries=entries.slice(-MAX_CHAT_HISTORY);draw();
   if(isOpen())read();else if(entry.userId!==getId()){unread++;badge.textContent=unread>99?'99+':String(unread);badge.hidden=false;}
  },
 };
}
