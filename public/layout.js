// Keep the original seat indices stable for people already in the room.
export const seats = [[-3.4,-1.9,1.9,3.4],[-6.4,-4.9,4.9,6.4]].flatMap(columns=>
 Array.from({length:20},(_,i)=>({x:columns[i%4],z:1+Math.floor(i/4)*2,y:Math.floor(i/4)*1.0})));
export function position(x,z,stage) {
  const limit=(v,a,b)=>Math.min(b,Math.max(a,v));
  return {x:limit(x,stage?-6:-9,stage?6:9),z:limit(z,stage?-6.6:-1.6,stage?-3:15.65)};
}
export function clearSeat(x,z){return seats.every(s=>Math.abs(s.x-x)>.64 || Math.abs(s.z-z)>.65)}


export const aisles=[{x:0,width:1.65},{x:-8,width:1.5},{x:8,width:1.5}];
export const aisleSteps=aisles.flatMap(aisle=>Array.from({length:16},(_,index)=>{
 const row=1+Math.floor(index/4),step=index%4,depth=.225;
 return {...aisle,z:row*2-.9+(step+.5)*depth,depth,base:row-1,y:row-1+(step+1)*.25};
}));

export function floorHeight(z,x) {
  if(Number.isFinite(x))for(const step of aisleSteps){
    if(Math.abs(x-step.x)<=step.width/2&&z>=step.z-step.depth/2-1e-8&&z<step.z+step.depth/2)return step.y;
  }
  if (z >= 8) return 4.0;
  if (z >= 6) return 3.0;
  if (z >= 4) return 2.0;
  if (z >= 2) return 1.0;
  return 0;
}
