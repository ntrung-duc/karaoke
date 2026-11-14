export function standLocally(player){
  if(!player||player.seat<0)return false;
  player.seat=-1;player.z-=.83;player.jumpAt=0;return true;
}

// Full room snapshots may describe a pose from one network round-trip ago.
// Keep the local prediction unless the server actually seats/teleports us.
export function reconcilePlayer(local,server,{pendingStand=false,teleport=false}={}){
  const predict=local&&!teleport&&(pendingStand||local.seat<0&&server.seat<0);
  const player={...server};
  if(predict){
    for(const field of ['x','z','yaw','pitch','gait','movingUntil'])player[field]=local[field];
    if(pendingStand)player.seat=-1;
    // A delayed acknowledgement must not restart an already predicted jump.
    player.jumpAt=local.jumpAt;
  }
  return {player,pendingStand:pendingStand&&!teleport&&server.seat>=0};
}
