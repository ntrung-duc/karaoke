import {seats,clearSeat} from './layout.js';

// Search the walkable floor rather than driving straight through other chairs.
export function pathToSeat(from,index){
 const seat=seats[index];if(!seat)return null;
 const step=.2,minX=-9,minZ=-1.6,width=91,height=87;
 const point=id=>({x:minX+(id%width)*step,z:minZ+Math.floor(id/width)*step});
 const valid=new Uint8Array(width*height);
 for(let id=0;id<valid.length;id++){const p=point(id);valid[id]=Number(clearSeat(p.x,p.z));}
 const target={x:seat.x,z:seat.z-.83};
 function nearest(p){let best=-1,distance=Infinity;for(let id=0;id<valid.length;id++)if(valid[id]){const q=point(id),d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<distance){distance=d;best=id;}}return best;}
 const start=nearest(from),end=nearest(target),parents=new Int32Array(valid.length).fill(-1),queue=[start];parents[start]=start;
 for(let cursor=0;cursor<queue.length&&parents[end]<0;cursor++){
  const id=queue[cursor],x=id%width,z=Math.floor(id/width);
  for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const nx=x+dx,nz=z+dz,next=nz*width+nx;
   if(nx<0||nx>=width||nz<0||nz>=height||!valid[next]||parents[next]>=0)continue;
   parents[next]=id;queue.push(next);
  }
 }
 if(parents[end]<0)return null;
 const route=[];for(let id=end;id!==start;id=parents[id])route.push(point(id));route.push(point(start));route.reverse();route.push(target);
 // Remove only collinear points: every remaining segment stays on searched floor.
 return route.filter((p,i)=>i===0||i===route.length-1||Math.abs((p.x-route[i-1].x)*(route[i+1].z-p.z)-(p.z-route[i-1].z)*(route[i+1].x-p.x))>1e-6);
}
