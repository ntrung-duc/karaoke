import * as T from 'three';

// A shared lightweight billboard texture: curved stem, leaves and layered rose petals.
function roseTexture(){
 const canvas=document.createElement('canvas');canvas.width=192;canvas.height=320;
 const c=canvas.getContext('2d');
 c.lineCap='round';c.strokeStyle='#39772e';c.lineWidth=8;
 c.beginPath();c.moveTo(90,302);c.bezierCurveTo(120,235,70,175,99,110);c.stroke();
 for(const [x,y,side] of [[99,205,-1],[100,247,1],[98,155,1]]){
  const g=c.createLinearGradient(x,y,x+side*60,y-35);g.addColorStop(0,'#163b16');g.addColorStop(.6,'#488e31');g.addColorStop(1,'#85aa4d');c.fillStyle=g;
  c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+side*58,y+2,x+side*70,y-44);c.quadraticCurveTo(x+side*12,y-51,x,y);c.fill();
  c.strokeStyle='#89a252';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+side*62,y-39);c.stroke();
 }
 c.fillStyle='#527a26';c.beginPath();c.moveTo(98,130);c.lineTo(50,105);c.lineTo(142,105);c.closePath();c.fill();
 for(let ring=0;ring<4;ring++)for(let i=0;i<7;i++){
  const a=i*Math.PI*2/7+ring*.55,r=29-ring*7,x=96+Math.cos(a)*r,y=75+Math.sin(a)*r*.65;
  c.save();c.translate(x,y);c.rotate(a+.4);
  const g=c.createRadialGradient(-7,-9,1,0,0,35-ring*5);g.addColorStop(0,'#ff4356');g.addColorStop(.4,'#c61230');g.addColorStop(1,'#580817');c.fillStyle=g;
  c.beginPath();c.ellipse(0,0,34-ring*5,23-ring*3,0,0,Math.PI*2);c.fill();c.restore();
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

export function createFlowers(scene){
 const texture=roseTexture(),items=[],seen=new Set();let turn=null;
 function remove(item){scene.remove(item.sprite);item.sprite.material.dispose();}
 function clear(){for(const item of items)remove(item);items.length=0;seen.clear();}
 return {
  turn(key){if(turn!==key){turn=key;clear();}},
  receive(event,now){
   if(event.key!==turn||seen.has(event.id)||now-event.at>7000)return;
   seen.add(event.id);if(seen.size>256)seen.delete(seen.values().next().value);
   if(items.length>=60)remove(items.shift());
   const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
   sprite.scale.set(.39,.65,1);scene.add(sprite);items.push({sprite,event});
  },
  update(now){
   for(let i=items.length-1;i>=0;i--){
    const {sprite,event}=items[i],age=(now-event.at)/1000;
    if(age>7){remove(items.splice(i,1)[0]);continue;}
    const t=Math.max(0,Math.min(1,age/1.35)),a=event.from,b=event.to;
    sprite.position.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t+Math.sin(t*Math.PI)*3,a.z+(b.z-a.z)*t);
    sprite.material.rotation=t<1?Math.sin(t*Math.PI*2)*.65:1.15;
    sprite.material.opacity=Math.min(1,(7-age)/1.5);
   }
  },
 };
}
