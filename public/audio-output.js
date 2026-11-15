export function createAudioOutput({getPlayer=()=>null,getAudio=()=>[],storage,onChange=()=>{}}={}){
 let muted=false,blocked=false;
 try{muted=storage?.getItem('rap-muted')==='1';}catch{}
 function notify(){onChange({muted,label:muted||blocked?'Bật âm thanh':'Tắt âm thanh'});}
 function apply(){const player=getPlayer();if(player){if(muted)player.mute();else player.unMute();}for(const audio of getAudio())audio.muted=muted;notify();}
 function block(){if(!muted){blocked=true;notify();}}
 return {
  get muted(){return muted;},apply,block,
  attach(audio){audio.muted=muted;},
  toggle(){
   const enable=muted||blocked;muted=!enable;blocked=false;
   try{storage?.setItem('rap-muted',muted?'1':'0');}catch{}
   apply();
   if(enable){getPlayer()?.playVideo();for(const audio of getAudio())Promise.resolve(audio.play()).catch(block);}
  },
 };
}
