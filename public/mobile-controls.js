export function joystickVector(dx,dy,radius=36){
 const distance=Math.hypot(dx,dy),fraction=Math.min(1,distance/radius),strength=Math.max(0,(fraction-.12)/.88);
 if(!distance)return {forward:0,right:0,x:0,y:0};
 return {forward:strength?-dy/distance*strength:0,right:strength?dx/distance*strength:0,x:dx/distance*fraction*radius,y:dy/distance*fraction*radius};
}

export function createJoystick(element,{onStart=()=>{},onMove=()=>{}}={}){
 const thumb=element.querySelector('span');let pointer=null;
 function reset(){pointer=null;thumb.style.transform='translate(0px,0px)';element.classList.remove('active');onMove(0,0);}
 function move(event){
  if(event.pointerId!==pointer)return;event.preventDefault();const box=element.getBoundingClientRect();
  const value=joystickVector(event.clientX-box.left-box.width/2,event.clientY-box.top-box.height/2,box.width*.32);
  thumb.style.transform=`translate(${value.x}px,${value.y}px)`;onMove(value.forward,value.right);
 }
 element.onpointerdown=event=>{
  if(pointer!==null||event.button!==0)return;event.preventDefault();if(onStart()===false)return;pointer=event.pointerId;element.setPointerCapture(pointer);element.classList.add('active');move(event);
 };
 element.onpointermove=move;
 element.onpointerup=element.onpointercancel=element.onlostpointercapture=event=>{if(event.pointerId===pointer)reset();};
 element.oncontextmenu=event=>event.preventDefault();
 return {reset,get active(){return pointer!==null;}};
}

// Canvas touches only: a joystick finger can move independently of camera drag.
// Once pinching starts, the remaining finger cannot become an accidental tap.
export function createTouchCamera(){
 const points=new Map();let pinched=false;
 const distance=()=>{const [a,b]=[...points.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
 return {
  get count(){return points.size;},
  begin(id,x,y){points.set(id,{x,y});if(points.size>1)pinched=true;},
  move(id,x,y){
   const old=points.get(id);if(!old)return null;
   const before=points.size===2?distance():0;points.set(id,{x,y});
   if(points.size===2)return {kind:'zoom',delta:(before-distance())*3};
   if(points.size===1&&!pinched)return {kind:'turn',dx:x-old.x,dy:y-old.y};
   return null;
  },
  end(id){points.delete(id);if(!points.size)pinched=false;},
  reset(){points.clear();pinched=false;},
 };
}
