export const songElapsed=(song,now)=>Math.max(0,((Number.isFinite(song.pausedAt)?song.pausedAt:now)-song.start)/1000);

export function createVoiceDelay(storage){
 const parse=(value,fallback)=>value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))?fallback:Math.round(Math.max(0,Math.min(2000,Number(value)))/50)*50;
 let value=650;try{value=parse(storage?.getItem('rap-voice-delay'),650);}catch{}
 return {get value(){return value;},set(next){value=parse(next,value);try{storage?.setItem('rap-voice-delay',String(value));}catch{}return value;}};
}

// Fixed audience offset, applied at song entry, explicit pause/resume or when
// the listener changes it. Periodic state updates never seek a playing video.
export function createVideoSync(){
 let key=null,paused=false,holding=false,appliedDelay=0,lastSeek=-Infinity,stableAt=0;
 return {sync({song,id,player,now,delayMs=0,position=null}){
  if(!song){if(key!==null)player.stopVideo();key=null;paused=holding=false;return false;}
  const audience=song.owner!==id,delay=audience&&Number.isFinite(delayMs)?Math.max(0,Math.min(2000,delayMs))/1000:0;
  const sample=audience&&position?.key===song.key&&position.start===song.start&&now-position.at>=0&&now-position.at<6000?position:null;
  const source=sample?sample.position+(sample.state===1?Math.max(0,now-sample.at)/1000:0):songElapsed(song,now),target=Math.max(0,source-delay),manual=Number.isFinite(song.pausedAt),wait=audience&&source<delay;
  if(key!==song.key){lastSeek=now;stableAt=0;key=song.key;paused=manual;holding=wait;appliedDelay=delay;const video={videoId:song.video,startSeconds:target};if(manual||wait)player.cueVideoById(video);else player.loadVideoById(video);return true;}
  if(player.getVideoData()?.video_id!==song.video)return false;
  const state=player.getPlayerState(),resume=(paused&&!manual)||(holding&&!wait),delayChanged=appliedDelay!==delay;
  paused=manual;holding=wait;appliedDelay=delay;
  if(manual||wait){if(state===1)player.pauseVideo();return false;}
  if(resume){player.seekTo(target,true);player.playVideo();return false;}
  if(delayChanged&&audience){lastSeek=now;player.seekTo(target,true);}
  // Correct only sustained drift while both videos are playing. Buffering
  // samples never pause the audience or trigger a repeated seek loop.
  if(state!==1)stableAt=0;else if(!stableAt)stableAt=now;
  if(sample?.state===1&&state===1&&stableAt&&now-stableAt>4000&&now-lastSeek>10000&&Math.abs(player.getCurrentTime()-target)>1.5){lastSeek=now;player.seekTo(target,true);}

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
  if(Number.isFinite(song.pausedAt))return;
  const ended=elapsed>=Math.max(0,duration-3)&&player.getPlayerState()===0&&player.getCurrentTime()>=duration-.75;
  if((ended||elapsed>=duration+2&&player.getPlayerState()!==3&&player.getCurrentTime()>=duration-.75)&&(nextAttempt!==song.key||now-nextAt>1500)){
   nextAttempt=song.key;nextAt=now;send({type:'next',key:song.key});
  }
 }};
}
