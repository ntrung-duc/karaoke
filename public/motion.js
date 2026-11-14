export const WALK_SPEED=2, RUN_SPEED=4;
export const TAKEOFF=.08, FLIGHT=.70, LANDING=.12;
export const JUMP_DURATION=TAKEOFF+FLIGHT+LANDING;
export const JUMP_HEIGHT=.95;
export const directions=['Forward','ForwardRight','Right','BackwardRight','Backward','BackwardLeft','Left','ForwardLeft'];
export const gaits=new Set(['idle',...['walk','run'].flatMap(g=>directions.map(d=>g+d))]);
export function movementGait(forward,right,running) {
 if(!forward&&!right)return 'idle';
 const index=(Math.round(Math.atan2(right,forward)/(Math.PI/4))+8)%8;
 return (running?'run':'walk')+directions[index];
}
export function displacementGait(dx,dz,bodyYaw,running){
 return movementGait(-dx*Math.sin(bodyYaw)-dz*Math.cos(bodyYaw),dx*Math.cos(bodyYaw)-dz*Math.sin(bodyYaw),running);
}
// A shared timeline keeps remote avatars in flight without per-frame packets.
export function jumpPose(jumpAt,now) {
 const elapsed=(now-jumpAt)/1000;
 if(!jumpAt||elapsed<0||elapsed>=JUMP_DURATION)return {height:0,state:null,elapsed};
 const airborne=TAKEOFF+FLIGHT;
 if(elapsed<airborne){const progress=elapsed/airborne;return {height:4*JUMP_HEIGHT*progress*(1-progress),state:elapsed<TAKEOFF?'jump':'fall',elapsed};}
 return {height:0,state:'land',elapsed};
}
