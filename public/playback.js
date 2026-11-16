export const songElapsed=(song,now)=>song.buffering&&song.playhead?Math.max(0,song.playhead.position):Math.max(0,((Number.isFinite(song.pausedAt)?song.pausedAt:now)-song.start)/1000);

export function createVoiceDelay(storage){
 const parse=(value,fallback)=>value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))?fallback:Math.round(Math.max(0,Math.min(2000,Number(value)))/50)*50;
 let value=300;try{value=parse(storage?.getItem('rap-voice-delay'),300);}catch{}
 return {get value(){return value;},set(next){value=parse(next,value);try{storage?.setItem('rap-voice-delay',String(value));}catch{}return value;}};
}

export function createPlayheadReporter(send,clock=Date.now){
 let key=null,state=null,last=-Infinity;
 return {check({song,id,player}){
  if(!song||song.owner!==id||Number.isFinite(song.pausedAt)||player.getVideoData()?.video_id!==song.video)return;
  const next=player.getPlayerState(),position=player.getCurrentTime(),now=clock();
  if(![1,3].includes(next)||!Number.isFinite(position)||position<0)return;
  if(key===song.key&&now-last<(state===next?900:200))return;
  if(send({type:'playhead',key:song.key,video:song.video,position,state:next,sampleAt:now})!==false){key=song.key;state=next;last=now;}
 }};
}

// Correct spectators against the singer's clock, without repeatedly seeking
// the singer or seeking a player that is already buffering.
export function createVideoSync(clock=Date.now){
 let key=null,paused=false,holding=false,lastSeek=-Infinity,lastPlay=-Infinity,appliedDelay=0;
 return {sync({song,id,player,now,delayMs=0}){
  if(!song){if(key!==null)player.stopVideo();key=null;paused=holding=false;return false;}
  const audience=song.owner!==id,delay=audience&&Number.isFinite(delayMs)?Math.max(0,Math.min(2000,delayMs))/1000:0;
  const sourcePosition=songElapsed(song,now),target=Math.max(0,sourcePosition-delay),manual=Number.isFinite(song.pausedAt),wait=audience&&(!!song.buffering||sourcePosition<delay),time=clock();
  if(key!==song.key){key=song.key;paused=manual;holding=wait;appliedDelay=delay;lastSeek=lastPlay=-Infinity;const video={videoId:song.video,startSeconds:target};if(manual||wait)player.cueVideoById(video);else player.loadVideoById(video);return true;}
  if(player.getVideoData()?.video_id!==song.video)return false;
  const state=player.getPlayerState(),position=player.getCurrentTime(),drift=target-position,resume=(paused&&!manual)||(holding&&!wait);
  paused=manual;holding=wait;
  if(manual||wait){
   if(state===1)player.pauseVideo();
   if(state!==3&&Math.abs(drift)>.35&&time-lastSeek>1500){lastSeek=time;player.seekTo(target,true);}
   return false;
  }
  if(resume){appliedDelay=delay;lastSeek=lastPlay=time;player.seekTo(target,true);player.playVideo();return false;}
  if(state===1&&audience&&((Math.abs(drift)>(delay ? .25 : .45)&&time-lastSeek>2500)||(delay!==appliedDelay&&Math.abs(drift)>.04&&time-lastSeek>600))){appliedDelay=delay;lastSeek=time;player.seekTo(target,true);}
  else if([2,5].includes(state)&&time-lastPlay>2000){lastPlay=time;player.playVideo();}
  return false;
 }};
}

// ENDED events can be missed during reconnect/background playback. Polling and
// a server-side deadline are complementary; the song key makes retries safe.
export function createPlaybackMonitor(send,clock=Date.now){
 let durationAttempt='',durationAt=-Infinity,nextAttempt='',nextAt=-Infinity;
 return {check({song,id,player,elapsed}){
  if(!song||song.owner!==id||player.getVideoData()?.video_id!==song.video)return;
  const duration=player.getDuration();
  if(!Number.isFinite(duration)||duration<=0||duration>21600)return;
  const signature=song.key+':'+duration.toFixed(2),now=clock();
  if(Math.abs((song.duration||0)-duration)>.1&&(durationAttempt!==signature||now-durationAt>3000)){
   durationAttempt=signature;durationAt=now;send({type:'duration',key:song.key,video:song.video,duration});
  }
  if(Number.isFinite(song.pausedAt)||song.buffering)return;
  const ended=elapsed>=Math.max(0,duration-3)&&player.getPlayerState()===0&&player.getCurrentTime()>=duration-.75;
  if((ended||elapsed>=duration+2&&player.getPlayerState()!==3&&player.getCurrentTime()>=duration-.75)&&(nextAttempt!==song.key||now-nextAt>1500)){
   nextAttempt=song.key;nextAt=now;send({type:'next',key:song.key});
  }
 }};
}
