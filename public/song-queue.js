// Successful socket.send is not an acknowledgement from the room.
export function createSongQueue({send}){
 const pending=new Map();
 function finish(requestId,message){const entry=pending.get(requestId);if(!entry)return;clearTimeout(entry.timer);pending.delete(requestId);if(message.accepted)entry.resolve(message);else entry.reject(new Error(message.error||'Chưa đăng ký được bài hát.'));}
 return {
  submit(video,title){const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>finish(requestId,{error:'Chưa nhận được xác nhận từ phòng. Kiểm tra kết nối rồi thử lại.'}),15000);
   pending.set(requestId,{resolve,reject,timer});
   if(!send({type:'queue',requestId,video,title}))finish(requestId,{error:'Đang chờ kết nối phòng.'});
  });},
  receive(message){finish(message.requestId,message);},
  disconnected(){for(const requestId of [...pending.keys()])finish(requestId,{error:'Mất kết nối trước khi xác nhận đăng ký bài. Hãy kiểm tra hàng đợi rồi thử lại.'});}
 };
}
