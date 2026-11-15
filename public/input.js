const physicalKeys={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright',ShiftLeft:'shift',ShiftRight:'shift'};
const fallbackKeys=new Set(Object.values(physicalKeys));

// IMEs can report key="Process" or a composed character while the physical
// code remains KeyW/KeyA/KeyS/KeyD. Never wait for character composition/repeat.
export function movementKey(event){
  if(physicalKeys[event.code])return physicalKeys[event.code];
  if(event.code&&event.code!=='Unidentified')return null;
  const key=event.key?.toLowerCase();return fallbackKeys.has(key)?key:null;
}

export function createMovementInput(){
 const keys=new Set();
 return {
  keys,
  press(event){
   const key=movementKey(event);
   if(!key||event.ctrlKey||event.altKey||event.metaKey)return null;
   // A delayed IME/OS repeat must not re-latch a key after it was released.
   if(event.repeat&&!keys.has(key))return null;
   keys.add(key);return key;
  },
  release(event){
   const key=movementKey(event);
   if(key)keys.delete(key);
   else if(!event.code||event.code==='Unidentified'||event.key==='Process')keys.clear();
  },
  clear(){keys.clear();},
 };
}
