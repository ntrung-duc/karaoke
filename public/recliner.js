import * as T from 'three';
import {roundedBox} from './toy-avatar.js';

// Each component is drawn once for every seat, with shared geometry/materials.
// The reference's upholstery is represented by rounded cushions and seam piping.
export function addRecliners(scene,seats){
 const fabric=new T.MeshStandardMaterial({color:'#701c2a',roughness:.96,emissive:'#701c2a',emissiveIntensity:.06});
 const seams=new T.MeshStandardMaterial({color:'#49131d',roughness:1});
 const base=new T.MeshStandardMaterial({color:'#262932',roughness:.6,metalness:.25});
 const transform=new T.Object3D(),parts=[];
 function part(name,geometry,material,x,y,z,rx=0,rz=0){
  const instances=new T.InstancedMesh(geometry,material,seats.length);instances.name='Recliner-'+name;
  instances.castShadow=instances.receiveShadow=true;
  seats.forEach((seat,index)=>{
   transform.position.set(seat.x+x,(seat.y||0)+y,seat.z+z);transform.rotation.set(rx,0,rz);transform.scale.set(1,1,1);transform.updateMatrix();instances.setMatrixAt(index,transform.matrix);
  });
  instances.instanceMatrix.needsUpdate=true;instances.computeBoundingBox();instances.computeBoundingSphere();scene.add(instances);parts.push(instances);
 }
 const cushion=(name,w,h,d,r,x,y,z,rx=0,rz=0)=>part(name,roundedBox(w,h,d,r),fabric,x,y,z,rx,rz);
 part('swivel-base',new T.CylinderGeometry(.46,.48,.075,24),base,0,.07,.04);
 cushion('lower-front',.93,.48,.88,.065,0,.34,.04);
 cushion('seat-piping',.95,.034,.91,.015,0,.61,-.035);
 cushion('seat',.94,.23,.9,.085,0,.685,-.035);
 cushion('back-shell',1.03,1.12,.22,.07,0,1.12,.47,-.09);
 for(let row=0;row<3;row++){
  const y=.91+row*.32,z=.33+row*.029;
  cushion('back-cushion-'+row,.98,.34,.26,.10,0,y,z,-.09);
 }
 for(const side of [-1,1]){
  cushion('arm-body-'+side,.23,.71,.98,.08,side*.55,.49,.025);
  cushion('arm-piping-'+side,.29,.026,.91,.012,side*.55,.82,-.015);
  cushion('arm-pillow-'+side,.31,.18,.93,.075,side*.55,.88,-.015,0,side*.06);
  const lever=new T.CylinderGeometry(.066,.066,.024,16);lever.rotateZ(Math.PI/2);
  part('recline-lever-'+side,lever,base,side*.675,.48,-.16);
 }
 // A subtle central seam on the lumbar cushion, as in the reference.
 part('lumbar-seam',roundedBox(.009,.24,.012,.004),seams,0,.91,.194,-.09);
 return parts;
}
