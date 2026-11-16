// Pixel layout shared by the camera-facing lyric screen and responsive HUD.
export function singerScreenRect(width,height,{chatTop=height-65,chatLeft=width/2-220,chatBottom=height-18,desktop=false,controlsBottom=55,joystick=null}={}){
 if(desktop){
  const w=Math.max(0,Math.min(420,chatLeft-36,height*.45*16/9)),h=w*9/16;
  return {x:18,y:chatBottom-h,width:w,height:h};
 }
 const top=Math.max(12,controlsBottom+14);let bottom=Math.min(height-12,chatTop-12);
 const fit=limit=>Math.max(0,Math.min(480,width-32,limit,Math.max(0,bottom-top)*16/9,height*.48*16/9));
 let w=fit(Infinity),x=(width-w)/2;
 if(joystick&&x<joystick.right+12&&x+w>joystick.left-12&&bottom>joystick.top-12){
  if(height>width){bottom=Math.min(bottom,joystick.top-12);w=fit(Infinity);}
  else w=fit(Math.max(0,width-2*(joystick.right+12)));
  x=(width-w)/2;
 }
 const h=w*9/16;
 return {x,y:bottom-h,width:w,height:h};
}
