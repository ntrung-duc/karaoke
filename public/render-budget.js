// Prefer a stable frame rate over rendering more pixels than the GPU can handle.
export function createRenderBudget(maximum=1){
 let ratio=maximum,average=16.7,frames=0;
 return {sample(ms){
  if(!Number.isFinite(ms)||ms<=0||ms>200)return ratio;
  average+=(ms-average)*.08;
  if(++frames<120)return ratio;
  frames=0;
  if(average>23)ratio=Math.max(Math.min(.65,maximum),ratio-.15);
  else if(average<18)ratio=Math.min(maximum,ratio+.1);
  return ratio;
 }};
}
