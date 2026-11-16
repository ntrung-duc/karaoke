// Midpoint clock samples avoid treating one-way network latency as clock skew.
export function createServerClock({send,wall=Date.now,mono=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,setRepeat=setInterval,clearRepeat=clearInterval}){
 let base=wall()-mono(),sequence=0,measured=false,timers=[],repeat;const pending=new Map(),samples=[];
 function request(){const seq=++sequence,at=mono();pending.set(seq,at);if(!send({type:'clock',seq}))pending.delete(seq);for(const [id,time] of pending)if(at-time>5000)pending.delete(id);}
 function stop(){timers.forEach(clearTimer);timers=[];clearRepeat(repeat);pending.clear();}
 return {
  now:()=>mono()+base,
  observe(serverNow){if(!measured&&Number.isFinite(serverNow))base=serverNow-mono();},
  receive(message){
   const start=pending.get(message.seq);if(start===undefined||!Number.isFinite(message.serverTime))return false;pending.delete(message.seq);
   const end=mono(),rtt=end-start;if(rtt<0||rtt>5000)return false;
   samples.push({rtt,base:message.serverTime+rtt/2-end,at:end});
   while(samples.length>8||samples.length&&end-samples[0].at>60000)samples.shift();
   base=samples.reduce((a,b)=>a.rtt<=b.rtt?a:b).base;measured=true;return true;
  },
  request,stop,start(){stop();request();timers=[setTimer(request,350),setTimer(request,1200)];repeat=setRepeat(request,15000);},
 };
}
