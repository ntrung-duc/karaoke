export function createSongSearch({send,notice}){
 const form=document.querySelector('#search-form'),query=document.querySelector('#search-query'),results=document.querySelector('#search-results'),status=document.querySelector('#search-status'),button=form.querySelector('button');
 let pending=null,timer;
 function finish(){pending=null;clearTimeout(timer);button.disabled=false;results.removeAttribute('aria-busy');}
 form.onsubmit=event=>{
  event.preventDefault();if(pending)return;
  const text=query.value.trim();if(text.length<2){status.textContent='Nhập ít nhất 2 ký tự để tìm bài.';return;}
  pending=crypto.randomUUID();
  if(!send({type:'search',requestId:pending,query:text,karaoke:document.querySelector('#search-karaoke').checked})){finish();status.textContent='Đang chờ kết nối phòng.';return;}
  button.disabled=true;results.setAttribute('aria-busy','true');results.replaceChildren();status.textContent='Đang tìm trên YouTube…';
  timer=setTimeout(()=>{finish();status.textContent='Tìm kiếm hơi lâu. Thử lại hoặc dán liên kết video bên dưới.';},12000);
 };
 return {receive(message){
  if(message.requestId!==pending)return;finish();
  if(message.error){status.textContent=message.error;return;}
  const items=message.items||[];status.textContent=items.length?`${items.length} kết quả từ YouTube`:'Không có kết quả. Thử tên bài hoặc ca sĩ khác nhé.';
  for(const item of items){
   const card=document.createElement('article');card.className='search-result';
   const link=document.createElement('a');link.href='https://www.youtube.com/watch?v='+encodeURIComponent(item.video);link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Xem '+item.title+' trên YouTube');
   const thumbnail=document.createElement('img');thumbnail.src=item.thumbnail;thumbnail.alt='';thumbnail.loading='lazy';thumbnail.width=120;thumbnail.height=68;link.append(thumbnail);
   const details=document.createElement('div'),title=document.createElement('strong'),channel=document.createElement('p'),add=document.createElement('button');
   // YouTube snippets encode entities; parse as inert text, never insert markup.
   const text=new DOMParser().parseFromString(item.title,'text/html').documentElement.textContent;
   title.textContent=text;channel.textContent=item.channel;add.type='button';add.textContent='＋ Thêm vào hàng đợi';
   add.onclick=()=>{if(send({type:'queue',video:item.video,title:text.slice(0,80)})){notice('Đã thêm bài vào hàng đợi.');add.textContent='✓ Đã thêm';add.disabled=true;}else notice('Đang chờ kết nối phòng.');};
   details.append(title,channel,add);card.append(link,details);results.append(card);
  }
 },disconnected(){if(pending){finish();status.textContent='Mất kết nối. Kết nối lại rồi tìm tiếp nhé.';}}};
}
