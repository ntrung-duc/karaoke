export function createAudioOutput({getPlayer=()=>null,getAudio=()=>[],canPlay=()=>true,storage,onChange=()=>{}}={}){
 let muted=false,blocked=false;
 const volume=(value,fallback)=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?fallback:Math.round(Math.max(0,Math.min(100,Number(value))));
 function readVolume(key,fallback){try{return volume(storage?.getItem(key),fallback);}catch{return fallback;}}
 let musicVolume=readVolume('rap-music-volume',30),voiceVolume=readVolume('rap-voice-volume',100);
 function notify(){onChange({muted,musicVolume,voiceVolume,label:muted||blocked?'Bật âm thanh':'Tắt âm thanh'});}
 function attach(audio){audio.muted=muted||voiceVolume===0;audio.volume=voiceVolume/100;}
 function apply(){const player=getPlayer();if(player){player.setVolume?.(musicVolume);if(muted||musicVolume===0)player.mute();else player.unMute();}for(const audio of getAudio())attach(audio);notify();}
 function setVolume(kind,value){
  if(kind==='music'){musicVolume=volume(value,musicVolume);try{storage?.setItem('rap-music-volume',String(musicVolume));}catch{}}
  else if(kind==='voice'){voiceVolume=volume(value,voiceVolume);try{storage?.setItem('rap-voice-volume',String(voiceVolume));}catch{}}
  else return;
  apply();
 }
 function block(){if(!muted){blocked=true;notify();}}
 function enable({restoreSilentLevels=false}={}){
  muted=false;blocked=false;
  try{storage?.setItem('rap-muted','0');}catch{}
  if(restoreSilentLevels){if(musicVolume===0)setVolume('music',30);if(voiceVolume===0)setVolume('voice',100);}
  apply();
  if(canPlay())getPlayer()?.playVideo();
  for(const audio of getAudio())Promise.resolve(audio.play()).catch(block);
 }
 return {
  get muted(){return muted;},get musicVolume(){return musicVolume;},get voiceVolume(){return voiceVolume;},apply,block,setVolume,attach,enable,
  toggle(){
   const enable=muted||blocked;muted=!enable;blocked=false;
   try{storage?.setItem('rap-muted',muted?'1':'0');}catch{}
   apply();
   if(enable){if(canPlay())getPlayer()?.playVideo();for(const audio of getAudio())Promise.resolve(audio.play()).catch(block);}
  },
 };
}
