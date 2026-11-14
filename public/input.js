const physicalKeys={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright',ShiftLeft:'shift',ShiftRight:'shift'};
const fallbackKeys=new Set(Object.values(physicalKeys));

// IMEs can report key="Process" or a composed character while the physical
// code remains KeyW/KeyA/KeyS/KeyD. Never wait for character composition/repeat.
export function movementKey(event){
  if(physicalKeys[event.code])return physicalKeys[event.code];
  if(event.code&&event.code!=='Unidentified')return null;
  const key=event.key?.toLowerCase();return fallbackKeys.has(key)?key:null;
}
