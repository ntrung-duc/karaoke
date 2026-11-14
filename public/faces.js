import * as T from 'three';
import {FACES,faceIndex} from './avatar-settings.js';

let atlas;
const textures=new Map();
const headTextures=new Map();
function loadAtlas(){
  return atlas ??= new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Không tải được bộ khuôn mặt.'));
    image.src='/assets/face-atlas.png';
  });
}

// Generate a transparent decal from the supplied sheet at runtime, excluding
// chart labels/borders and its uniform grey background.
async function faceCanvas(index){
  const image=await loadAtlas(),canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const [x,y,w,h]=FACES[faceIndex(index)].crop;
  const scale=232/Math.max(w,h),width=w*scale,height=h*scale;
  context.drawImage(image,x,y,w,h,(256-width)/2,(256-height)/2,width,height);
  const pixels=context.getImageData(0,0,256,256);
  for(let i=0;i<pixels.data.length;i+=4){
    const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
    const low=Math.min(r,g,b),chroma=Math.max(r,g,b)-low;
    if(chroma<22&&low>200)pixels.data[i+3]=0;
    else pixels.data[i+3]*=Math.min(1,Math.max(0,(238-low)/65));
  }
  context.putImageData(pixels,0,0);return canvas;
}
export function faceTexture(index){
  index=faceIndex(index);
  if(!textures.has(index))textures.set(index,faceCanvas(index).then(canvas=>{
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=4;return texture;
  }));
  return textures.get(index);
}
export function faceMaterial(){
  return new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,alphaTest:.025});
}
// Paint the face directly into the head's UV texture: no floating decal or
// second depth surface, including when the head turns all the way around.
export function headTexture(index){
  index=faceIndex(index);
  if(!headTextures.has(index))headTextures.set(index,faceTexture(index).then(face=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const context=canvas.getContext('2d');context.fillStyle='#d8dde7';context.fillRect(0,0,1024,512);
    // SphereGeometry's local -Z (the avatar's front) is at U = 3/4.
    context.drawImage(face.image,638,137,260,238);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
  }));
  return headTextures.get(index);
}

export function createFacePicker(root,onChange){
  const buttons=FACES.map((face,index)=>{
    const button=document.createElement('button');button.type='button';button.className='face-option';
    button.setAttribute('aria-label',face.name);button.setAttribute('aria-pressed','false');button.title=face.name;
    const preview=document.createElement('canvas');preview.width=preview.height=256;preview.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=face.name;button.append(preview,label);root.append(button);
    faceTexture(index).then(texture=>preview.getContext('2d').drawImage(texture.image,0,0)).catch(()=>{label.textContent=face.name+' · chưa tải';});
    button.onclick=()=>{select(index);onChange(index);};return button;
  });
  function select(index){index=faceIndex(index);buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));}
  select(0);return {select};
}
