// A pending local click may temporarily lead the room snapshot. The server
// wins on acknowledgement or a different turn; empty rooms never project a song.
export function projectPlayback(song,intent){
 if(!song||!intent||intent.key!==song.key||Number.isFinite(song.pausedAt)===intent.paused)return {song,intent:null};
 return {song:intent.song,intent};
}
