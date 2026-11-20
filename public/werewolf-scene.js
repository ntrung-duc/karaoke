import * as T from 'three';
import {wolfSeat} from './werewolf-rules.js';

export function createWerewolfScene(scene){
 const group=new T.Group();group.name='WerewolfCircle';group.visible=false;scene.add(group);
 const materials=new Map(),mat=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));return materials.get(color);};
 const ground=new T.Mesh(new T.CylinderGeometry(9,9,.2,48),mat('#253329'));ground.position.set(30,-.1,0);group.add(ground);
 const table=new T.Mesh(new T.CylinderGeometry(2.5,2.5,.35,32),mat('#63452f'));table.position.set(30,.45,0);group.add(table);
 const moon=new T.PointLight('#b7c6ff',35,28,1.5);moon.position.set(30,9,0);group.add(moon);
 const ambient=new T.HemisphereLight('#d8dfff','#586149',1.6);group.add(ambient);
 const seats=new T.Group(),cushionGeometry=new T.BoxGeometry(1.25,.45,1.15),backGeometry=new T.BoxGeometry(1.25,1.2,.18);group.add(seats);let count=-1;
 function update(g,users){group.visible=!!g;if(!g)return;const n=Math.max(5,g.players.length);if(n!==count){count=n;seats.clear();for(let i=0;i<n;i++){
  const p=wolfSeat(i,n),chair=new T.Group();chair.position.set(p.x,0,p.z);chair.rotation.y=p.yaw;
  const cushion=new T.Mesh(cushionGeometry,mat('#694b68'));cushion.position.y=.52;
  const back=new T.Mesh(backGeometry,mat('#432e43'));back.position.set(0,1,.48);chair.add(cushion,back);seats.add(chair);
 }}moon.color.set(g.phase==='night'?'#829de2':'#ffd4a2');ambient.intensity=g.phase==='night'?1.25:1.8;}
 function position(id,g,users){const index=g.players.findIndex(p=>p.id===id);if(index>=0&&g.players[index].alive)return {...wolfSeat(index,Math.max(5,g.players.length)),seated:true};const viewers=users.filter(u=>!g.players.some(p=>p.id===u.id&&p.alive)),i=viewers.findIndex(u=>u.id===id);return {x:22.3+(i%8)*2.1,z:8+Math.floor(i/8)*1.4,yaw:Math.PI,seated:false};}
 return {group,update,position};
}
