import * as T from 'three';
let pending;
export function loadWolfDance(){return pending??=fetch('/assets/wolf-dance.json').then(r=>{if(!r.ok)throw new Error('Không tải được Dancing Wolf');return r.json();}).catch(error=>{pending=null;throw error;});}
const rotation=new T.Quaternion(),offset=new T.Vector3();
export function applyWolfDance(parts,rig,data,elapsed){
 const time=((elapsed%data.duration)+data.duration)%data.duration,frames=data.frames;
 let index=0;while(index<frames.length-2&&frames[index+1][0]<=time)index++;
 const a=frames[index],b=frames[index+1],linear=(time-a[0])/(b[0]-a[0]),blend=linear*linear*(3-2*linear);
 const pose=a.map((v,i)=>v+(b[i]-v)*blend);
 const [,turn,lean,tilt,lax,laz,rax,raz,llx,llz,rlx,rlz]=pose;
 rig.rotation.y=turn;
 const torso=parts.get('torso');torso.rotation.set(lean,0,tilt);
 // Keep the rigid pieces connected while the whole figure sways and turns.
 rotation.copy(torso.quaternion);
 for(const [name,x,y] of [['head',0,.7057],['armL',.5293,.7057],['armR',-.5293,.7057],['legL',.1764,0],['legR',-.1764,0]]){
  const joint=parts.get(name);offset.set(x,y,0).applyQuaternion(rotation);joint.position.copy(torso.position).add(offset);
 }
 parts.get('head').quaternion.copy(rotation);
 for(const [name,x,z] of [['armL',lax,laz],['armR',rax,raz],['legL',llx,llz],['legR',rlx,rlz]]){
  const joint=parts.get(name);joint.rotation.set(x,0,z);joint.quaternion.premultiply(rotation);
 }
}
