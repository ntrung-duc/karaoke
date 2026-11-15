import * as T from 'three';

// Painted once into a shared texture; the scribbles cost no animation work.
export function createGraffitiTexture({width=2048,height=640,seed=17,title=false}={}){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ink=canvas.getContext('2d');let state=seed;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const colors=['#ff288e','#16e4ed','#ffe637','#ae4aff','#ff7833','#42f69b','#f3f0ff'];
 ink.fillStyle='#151321';ink.fillRect(0,0,width,height);ink.lineJoin='round';ink.lineCap='round';
 // Broad overlapping spray ribbons, marker loops and jagged hand-drawn lines.
 for(let i=0;i<85;i++){
  const x=random()*width,y=random()*height,span=(.05+random()*.22)*width;
  ink.strokeStyle=colors[i%colors.length];ink.globalAlpha=.4+random()*.5;ink.lineWidth=2+random()*height*.025;
  ink.beginPath();ink.moveTo(x,y);
  for(let j=1;j<=9;j++){const t=j/9;ink.lineTo(x+span*t,y+Math.sin(t*(5+random()*12))*height*(.03+random()*.15));}
  ink.stroke();
 }
 ink.globalAlpha=1;
 for(let i=0;i<230;i++){
  const x=random()*width,y=random()*height,r=1+random()*height*.009;
  ink.fillStyle=colors[i%colors.length];ink.beginPath();ink.arc(x,y,r,0,Math.PI*2);ink.fill();
  if(i%11===0){ink.strokeStyle=ink.fillStyle;ink.lineWidth=r*.7;ink.beginPath();ink.moveTo(x,y);ink.lineTo(x+random()*4,y+height*(.04+random()*.15));ink.stroke();}
 }
 const tags=['LOUD!','♫','VIBE','✦','SING!','♪','FLOW','★'];
 tags.forEach((tag,i)=>{
  ink.save();ink.translate(width*(.035+(i%4)*.25),height*(i<4?.2:.84));ink.rotate((random()-.5)*.5);
  ink.font=`900 italic ${height*(.13+random()*.06)}px Arial`;ink.strokeStyle='#11111a';ink.lineWidth=height*.018;ink.strokeText(tag,0,0);ink.fillStyle=colors[(i+2)%colors.length];ink.fillText(tag,0,0);
  ink.restore();
 });
 if(title){
  // A dark paint patch keeps the stage name readable through the wild layers.
  ink.fillStyle='#11121de8';ink.beginPath();ink.moveTo(width*.13,height*.28);ink.lineTo(width*.89,height*.25);ink.lineTo(width*.86,height*.76);ink.lineTo(width*.11,height*.8);ink.closePath();ink.fill();
  ink.textAlign='center';ink.font=`900 italic ${height*.25}px Arial`;ink.lineWidth=height*.025;ink.strokeStyle='#ff288e';ink.strokeText('Iron Dome',width*.5,height*.55);ink.lineWidth=height*.01;ink.strokeStyle='#181326';ink.strokeText('Iron Dome',width*.5,height*.55);ink.fillStyle='#fff6ed';ink.fillText('Iron Dome',width*.5,height*.55);
  ink.font=`900 ${height*.092}px Arial`;ink.fillStyle='#ffe637';ink.fillText('K A R A O K E',width*.5,height*.7);
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
