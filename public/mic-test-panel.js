import {createMicTest} from './mic-test.js';

export function createMicTestPanel({root,toggle,canTest=()=>true,notice=()=>{}}){
 const status=root.querySelector('[role="status"]'),meter=root.querySelector('meter'),audio=root.querySelector('audio');
 const start=root.querySelector('[data-mic-start]'),record=root.querySelector('[data-mic-record]');
 const clearAudio=()=>{audio.pause();if(audio.hasAttribute('src')){audio.removeAttribute('src');audio.load();}audio.hidden=true;};
 const tester=createMicTest({onState:({phase,message,url,canRecord})=>{
  status.textContent=message;
  start.disabled=['requesting','listening','recording'].includes(phase);
  record.disabled=phase!=='listening'||!canRecord;
  record.textContent=phase==='recording'?'Đang thu…':'Thu thử 5 giây';
  if(phase==='ready'&&url){audio.src=url;audio.hidden=false;}else clearAudio();
 },onLevel:value=>{meter.value=value;}});
 function close(){root.hidden=true;toggle.setAttribute('aria-expanded','false');tester.stop();}
 toggle.onclick=()=>{
  if(!root.hidden){close();return;}
  if(!canTest()){notice('Tắt mic đang phát cho phòng trước khi test mic.');return;}
  root.hidden=false;toggle.setAttribute('aria-expanded','true');tester.start();
 };
 start.onclick=()=>{if(canTest())tester.start();};record.onclick=()=>tester.record();
 root.querySelector('[data-mic-stop]').onclick=close;
 window.addEventListener('pagehide',close);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
 return {close};
}
