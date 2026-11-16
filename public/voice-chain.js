// Outgoing voice path: high-pass filter, gentle compression and adjustable reverb.
const clamp=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):0.2;

export function reverbImpulse(context,seconds=1.8,decay=3.2,random=Math.random){
 const rate=context.sampleRate,length=Math.max(1,Math.floor(rate*seconds)),preDelay=Math.floor(rate*0.02);
 const impulse=context.createBuffer(2,length,rate);
 for(let channel=0;channel<2;channel++){
  const data=impulse.getChannelData(channel);let low=0;
  for(let i=preDelay;i<length;i++){
   const t=(i-preDelay)/(length-preDelay);
   low+=((random()*2-1)-low)*(0.55-0.4*t);
   data[i]=low*Math.pow(1-t,decay);
  }
 }
 return impulse;
}

export function createVoiceChain(raw,{reverb=0.2,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
 if(!AudioContextClass||!raw?.getAudioTracks?.().length)return null;
 let context;
 try{
  context=new AudioContextClass({latencyHint:'interactive'});
  const source=context.createMediaStreamSource(raw);
  const analyser=context.createAnalyser();analyser.fftSize=1024;
  const samples=new Uint8Array(analyser.fftSize);source.connect(analyser);
  const level=()=>{analyser.getByteTimeDomainData(samples);let sum=0;for(const value of samples)sum+=((value-128)/128)**2;return Math.min(1,Math.sqrt(sum/samples.length)*4);};
  const highpass=context.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=80;
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-24;compressor.knee.value=20;compressor.ratio.value=3;compressor.attack.value=0.005;compressor.release.value=0.15;
  const dry=context.createGain(),wet=context.createGain(),convolver=context.createConvolver(),makeup=context.createGain();
  convolver.buffer=reverbImpulse(context);makeup.gain.value=1.1;
  const destination=context.createMediaStreamDestination();
  source.connect(highpass);highpass.connect(compressor);
  compressor.connect(dry);compressor.connect(convolver);convolver.connect(wet);
  dry.connect(makeup);wet.connect(makeup);makeup.connect(destination);
  const set=value=>{const amount=clamp(value),now=context.currentTime;dry.gain.setTargetAtTime(1-0.35*amount,now,0.03);wet.gain.setTargetAtTime(amount*1.2,now,0.03);};
  set(reverb);
  const ready=context.state==='running'?Promise.resolve(true):new Promise(resolve=>{
   let timer;const resumed=Promise.resolve().then(()=>context.resume()).then(()=>context.state==='running').catch(()=>false);
   Promise.race([resumed,new Promise(done=>{timer=setTimeout(()=>done(false),500);})]).then(value=>{clearTimeout(timer);resolve(value);});
  });
  let closed=false;
  return {
   stream:destination.stream,
   ready,
   level,
   setReverb:set,
   close(){if(closed)return;closed=true;try{source.disconnect();}catch{}context.close().catch(()=>{});},
  };
 }catch{
  try{context?.close();}catch{}
  return null;
 }
}
