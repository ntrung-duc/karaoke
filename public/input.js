const physicalKeys={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright',ShiftLeft:'shift',ShiftRight:'shift'};
const fallbackKeys=new Set(Object.values(physicalKeys));

// IMEs can report key="Process" or a composed character while the physical
// code remains KeyW/KeyA/KeyS/KeyD. Never wait for character composition/repeat.
export function movementKey(event){
  if(physicalKeys[event.code])return physicalKeys[event.code];
  if(event.code&&event.code!=='Unidentified')return null;
  const key=event.key?.toLowerCase();return fallbackKeys.has(key)?key:null;
}

export function createMovementInput(clock=()=>performance.now()){
 const keys=new Set();let previous=clock(),forward=0,right=0,lastPressAt=0;
 function accumulate(){
  const now=clock(),dt=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
  const f=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
  const r=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
  const length=Math.hypot(f,r);if(length){const step=dt*(keys.has('shift')?2:1)/length;forward+=f*step;right+=r*step;}
 }
 return {
  keys,
  press(event){
   const key=movementKey(event);
   if(!key||event.ctrlKey||event.altKey||event.metaKey)return null;
   // A delayed IME/OS repeat must not re-latch a key after it was released.
   if(event.repeat&&!keys.has(key))return null;
   accumulate();if(!keys.has(key))lastPressAt=clock();
   keys.add(key);return key;
  },
  release(event){
   accumulate();
   const key=movementKey(event);
   if(key)keys.delete(key);
   else if(!event.code||event.code==='Unidentified'||event.key==='Process')keys.clear();
  },
  sample(){accumulate();const result={forward,right,lastPressAt};forward=right=0;return result;},
  clear(){keys.clear();forward=right=0;previous=clock();},
 };
}
