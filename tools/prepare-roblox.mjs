// Preserve the supplied CC-BY model and separate its six rigid R6 parts.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
globalThis.ProgressEvent??=class{constructor(type,values){this.type=type;Object.assign(this,values);}};
const directory=new URL('./source-assets/roblox-noob/',import.meta.url);
const document=JSON.parse(await readFile(new URL('scene.gltf',directory),'utf8'));
const attribution=document.asset.extras;
document.buffers[0].uri='data:application/octet-stream;base64,'+(await readFile(new URL('scene.bin',directory))).toString('base64');
delete document.images;delete document.textures;
for(const material of document.materials)delete material.pbrMetallicRoughness.baseColorTexture;
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(document),'');gltf.scene.updateMatrixWorld(true);
let source;gltf.scene.traverse(o=>{if(o.isMesh)source=o;});
const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),bounds=new T.Box3().setFromBufferAttribute(geometry.attributes.position);
const center=bounds.getCenter(new T.Vector3()),scale=1.8/(bounds.max.y-bounds.min.y);
geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(scale,scale,scale);geometry.rotateY(Math.PI/2);
const root=new T.Group();root.name='RobloxNoob';root.userData.attribution={...attribution,changes:'Normalized scale; separated six R6 parts; replaced texture with user-selectable colors and face.'};
const groups={head:[],torso:[],armL:[],armR:[],legL:[],legR:[]},p=geometry.attributes.position,uv=geometry.attributes.uv,indices=geometry.index.array;
for(let i=0;i<indices.length;i+=3){
 const corners=[indices[i],indices[i+1],indices[i+2]],x=corners.reduce((s,v)=>s+p.getX(v),0)/3,y=corners.reduce((s,v)=>s+p.getY(v),0)/3;
 // Original atlas islands identify touching parts without cutting across a joint.
 const u=corners.reduce((s,v)=>s+uv.getX(v),0)/3*1024,v=corners.reduce((s,v)=>s+uv.getY(v),0)/3*512;
 const rect=(l,t,r,b)=>u>=l&&u<=r&&v>=t&&v<=b;
 const blue=rect(0,0,145,512)||rect(204,7,315,112)||rect(145,114,350,190);
 const green=rect(537,7,759,112)||rect(350,114,569,190)||rect(450,191,744,512);
 const part=blue?'torso':green?(x>0?'legL':'legR'):y>1.37&&Math.abs(x)<.23?'head':x>0?'armL':'armR';groups[part].push(...corners);
}
for(const [name,triangles] of Object.entries(groups)){
 const part=geometry.clone();part.setIndex(triangles);part.deleteAttribute('tangent');part.deleteAttribute('uv');
 const material=new T.MeshStandardMaterial({name:name==='head'?'Skin':name.startsWith('leg')?'Pants':'Suit',color:name==='head'?'#f1bd6b':name.startsWith('leg')?'#263449':'#5588cc',roughness:.75});
 const compact=part.toNonIndexed();part.dispose();compact.computeBoundingBox();compact.computeBoundingSphere();
 const mesh=new T.Mesh(compact,material);mesh.name=name;root.add(mesh);
}
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};
const output=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});
await writeFile('public/assets/roblox-noob.glb',Buffer.from(output));
console.log('Prepared Roblox Noob:',Object.fromEntries(Object.entries(groups).map(([name,list])=>[name,list.length/3])));
