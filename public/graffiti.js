import * as T from 'three';

// Original images supplied by the user, kept intact and fitted to each wall bay.
export const GRAFFITI_ART = [
 {file:'crocodile.png',aspect:1},
 {file:'einstein.png',aspect:386/518},
 {file:'skull.png',aspect:480/640},
 {file:'neon.png',aspect:1},
];
let library;
export function graffitiMaterials(){
 return library??=GRAFFITI_ART.map(art=>{
  const material=new T.MeshBasicMaterial({color:'#ffffff'});
  if(typeof document.createElementNS==='function'){
   material.map=new T.TextureLoader().load('/assets/graffiti/'+art.file);
   material.map.colorSpace=T.SRGBColorSpace;
  }
  return material;
 });
}

export function createStagePoster(){
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=700;
 const ink=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const images=new Map();
 function paint(){
  ink.fillStyle='#09090c';ink.fillRect(0,0,1600,700);
  // Fit each original image without stretching faces or cropping the artwork.
  for(const [index,x,w] of [[0,0,590],[1,600,400],[2,1010,420]]){
   const image=images.get(index);if(!image)continue;
   const scale=Math.min(w/image.width,570/image.height),iw=image.width*scale,ih=image.height*scale;
   ink.drawImage(image,x+(w-iw)/2,20+(570-ih)/2,iw,ih);
  }
  ink.fillStyle='#101015';ink.fillRect(0,590,1600,110);
  ink.textAlign='center';ink.fillStyle='#f5f0e7';ink.font='900 italic 67px Arial';ink.fillText('Iron Dome',800,650);
  ink.font='bold 22px Arial';ink.fillStyle='#f3d36d';ink.fillText('K A R A O K E',800,686);texture.needsUpdate=true;
 }
 paint();
 if(typeof Image!=='undefined')for(let i=0;i<3;i++){
  const image=new Image();image.onload=()=>{images.set(i,image);paint();};image.src='/assets/graffiti/'+GRAFFITI_ART[i].file;
 }
 return texture;
}
