// One transport per tab. The opaque resume token travels only in the WebSocket
// handshake message, never in a URL, public room snapshot or Git repository.
export function createConnection({room,onHello,onMessage,onStatus,onError=()=>{},storage=globalThis.sessionStorage,WebSocketClass=globalThis.WebSocket,setTimer=setTimeout,clearTimer=clearTimeout,random=Math.random,url}={}){
 const tokenKey='rap-session:'+room;
 const readToken=()=>{try{return storage?.getItem(tokenKey)||undefined;}catch{return undefined;}};
 function saveToken(token){try{if(token)storage?.setItem(tokenKey,token);else storage?.removeItem(tokenKey);}catch{}}
 let socket,timer,handshakeTimer,stopped=false,established=false,attempt=0,revision=0,stateRevision=0,id;
 function connect(){
  if(stopped)return;
  onStatus?.(attempt?'reconnecting':'connecting');
  const current=socket=new WebSocketClass(url||`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/live?room=${encodeURIComponent(room)}`);
  handshakeTimer=setTimer(()=>{if(!established&&socket===current)current.close();},12000);
  current.onopen=()=>{
   if(stopped||socket!==current)return;
   const resumeToken=readToken();current.send(JSON.stringify({type:'join',...(resumeToken?{resumeToken}:{})}));
  };
  current.onmessage=event=>{
   if(stopped||socket!==current)return;
   let message;try{message=JSON.parse(event.data);}catch{return;}
   if(message.type==='hello'){
    // New socket is a fresh revision epoch, even when the resume ID survives a restart.
    revision=0;stateRevision=0;
    id=message.id;saveToken(message.resumeToken);established=true;attempt=0;
    clearTimer(handshakeTimer);
    onHello?.(message);onStatus?.('connected');return;
   }
   if(!established)return;
   if(message.type==='error'){onError(message.message);return;}
   if(Number.isInteger(message.revision)){const floor=message.type==='state'?stateRevision:revision;if(message.revision<floor)return;if(message.type==='state')stateRevision=message.revision;revision=Math.max(revision,message.revision);}
   onMessage?.(message);
  };
  current.onerror=()=>{}; // onclose is the sole retry path.
  current.onclose=event=>{
   if(stopped||socket!==current)return;
   established=false;
   console.warn('Karaoke connection closed',{code:event.code,reason:event.reason||'No close reason',clean:event.wasClean});
   clearTimer(handshakeTimer);
   if(event.code===4001||event.code===1008){saveToken(undefined);revision=0;stateRevision=0;}
   onStatus?.('reconnecting');clearTimer(timer);
   const delay=Math.min(30000,500*2**Math.min(attempt++,6))*(.8+random()*.4);
   timer=setTimer(connect,delay);
  };
 }
 return {
  connect,
  send(message){if(!established||socket?.readyState!==1)return false;socket.send(JSON.stringify(message));return true;},
  close(){stopped=true;established=false;clearTimer(timer);clearTimer(handshakeTimer);socket?.close();},
 };
}
