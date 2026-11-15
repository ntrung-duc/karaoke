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
  const ended=elapsed>=Math.max(0,duration-3)&&player.getPlayerState()===0&&player.getCurrentTime()>=duration-.75;
  if((ended||elapsed>=duration+2)&&(nextAttempt!==song.key||now-nextAt>1500)){
   nextAttempt=song.key;nextAt=now;send({type:'next',key:song.key});
  }
 }};
}
