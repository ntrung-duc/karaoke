const physicalKeys={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright'};
const fallbackKeys=new Set(Object.values(physicalKeys));

// IMEs can report key="Process" or a composed character while the physical
// code remains KeyW/KeyA/KeyS/KeyD. Never wait for character composition/repeat.
export function movementKey(event){
  if(physicalKeys[event.code])return physicalKeys[event.code];
  if(event.code&&event.code!=='Unidentified')return null;
  const key=event.key?.toLowerCase();return fallbackKeys.has(key)?key:null;
}

export function createMovementInput(clock=()=>performance.now()){
 const keys=new Set(),released=new Set();let previous=clock(),forward=0,right=0,lastPressAt=0,analogForward=0,analogRight=0;
 function accumulate(){
  const now=clock(),dt=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
  const f=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))+analogForward;
  const r=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+analogRight;
  const length=Math.hypot(f,r);if(length){const step=dt/Math.max(1,length);forward+=f*step;right+=r*step;}
 }
 return {
  keys,
  press(event){
   const key=movementKey(event);
   if(!key||event.ctrlKey||event.altKey||event.metaKey)return null;
   // A delayed IME/OS repeat must not re-latch a key after it was released.
   if(event.repeat&&released.has(key))return null;
   if(!event.repeat)released.delete(key);
   accumulate();if(!keys.has(key))lastPressAt=clock();
   keys.add(key);return key;
  },
  release(event){
   accumulate();
   const key=movementKey(event);
   if(key){keys.delete(key);released.add(key);}
   else if(!event.code||event.code==='Unidentified'||event.key==='Process'){for(const held of keys)released.add(held);keys.clear();}
  },
  sample(){accumulate();const result={forward,right,lastPressAt};forward=right=0;return result;},
  analog(f,r){accumulate();if(!Number.isFinite(f)||!Number.isFinite(r))f=r=0;const length=Math.max(1,Math.hypot(f,r));if(!analogForward&&!analogRight&&(f||r))lastPressAt=clock();analogForward=f/length;analogRight=r/length;},
  clear(){keys.clear();forward=right=analogForward=analogRight=0;previous=clock();},
 };
}

// A key press or a camera drag cancels the click gesture, even if the pointer
// returns to its starting pixel before release.
export function createSeatGesture(){
 let start=null;
 return {
  begin(button,x,y,allowed=true){start=button===0&&allowed?{x,y}:null;},
  move(x,y){if(start&&Math.hypot(x-start.x,y-start.y)>6)start=null;},
  cancel(){start=null;},
  release(button,x,y){const pick=button===0&&!!start&&Math.hypot(x-start.x,y-start.y)<6;start=null;return pick;},
 };
}
