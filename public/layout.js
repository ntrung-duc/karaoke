// Keep the original seat indices stable for people already in the room.
export const seats = [[-3.4,-1.9,1.9,3.4],[-6.4,-4.9,4.9,6.4]].flatMap(columns=>
 Array.from({length:20},(_,i)=>({x:columns[i%4],z:1+Math.floor(i/4)*2,y:Math.floor(i/4)*0.35})));
export function position(x,z,stage) {
  const limit=(v,a,b)=>Math.min(b,Math.max(a,v));
  return {x:limit(x,stage?-6:-9,stage?6:9),z:limit(z,stage?-6.6:-1.6,stage?-3:15.65)};
}
export function clearSeat(x,z){return seats.every(s=>Math.abs(s.x-x)>.64 || Math.abs(s.z-z)>.65)}

