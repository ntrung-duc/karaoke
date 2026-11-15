import {wrapYaw} from './avatar-settings.js';

export const DEFAULT_DISTANCE=2.55;
export const FIRST_PERSON_THRESHOLD=.55;
export const MAX_DISTANCE=7;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Camera orientation is local-only. Avatar yaw/pitch change in first person.
export function createCameraControls(){
  return {
    mode:'avatar',yaw:0,pitch:-.32,distance:DEFAULT_DISTANCE,initialized:false,
    movementHeading(head){return this.mode==='first'?head.yaw:this.yaw;},
    faceMovement(head,dx,dz){
      if(this.mode!=='avatar'||!head||Math.hypot(dx,dz)<.00001)return false;
      head.bodyYaw=Math.atan2(-dx,-dz);head.yaw=head.bodyYaw;return true;
    },
    sync(head,reset=false){
      if(!this.initialized||reset){
        this.yaw=head.yaw;this.pitch=clamp(head.pitch-(this.mode==='avatar'?.32:0),-1,1);
        this.initialized=true;
      }else if(this.mode==='first'){
        this.yaw=head.yaw;this.pitch=head.pitch;
      }
    },
    setMode(mode,head){
      const previous=this.mode;this.mode=mode;
      if(mode==='overview')return false;
      if(mode==='first'){
        if(previous==='overview'&&head){this.yaw=head.yaw;this.pitch=head.pitch;}
        this.distance=0;
        if(head){head.yaw=this.yaw;head.pitch=this.pitch;return true;}
      }else{
        if(previous==='first'&&head){this.yaw=head.yaw;this.pitch=head.pitch;}
        if(this.distance<=FIRST_PERSON_THRESHOLD)this.distance=DEFAULT_DISTANCE;
      }
      return false;
    },
    turn(dx,dy,head){
      this.yaw=wrapYaw(this.yaw-dx);this.pitch=clamp(this.pitch-dy,-1,1);
      if(this.mode!=='first'||!head)return false;
      head.yaw=this.yaw;head.pitch=this.pitch;return true;
    },
    zoom(delta,head){
      if(!Number.isFinite(delta)||delta===0||this.mode==='overview')return false;
      if(this.mode==='first'){
        if(delta<0)return false;
        this.setMode('avatar',head);
        this.distance=clamp(FIRST_PERSON_THRESHOLD+delta*.004,.75,MAX_DISTANCE);
        return false;
      }
      this.distance=clamp(this.distance+delta*.004,0,MAX_DISTANCE);
      if(this.distance<=FIRST_PERSON_THRESHOLD)return this.setMode('first',head);
      return false;
    },
    cycle(head){
      return this.setMode(this.mode==='avatar'?'first':this.mode==='first'?'overview':'avatar',head);
    },
  };
}
