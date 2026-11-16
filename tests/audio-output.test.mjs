import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioOutput} from '../public/audio-output.js';

test('zero music uses explicit mute even when an iPhone player ignores setVolume; voice remains audible',()=>{
 let musicMuted=false;const voice={muted:false},player={setVolume(){},mute(){musicMuted=true;},unMute(){musicMuted=false;}};
 const output=createAudioOutput({getPlayer:()=>player,getAudio:()=>[voice]});
 output.setVolume('music',0);assert.equal(musicMuted,true);assert.equal(voice.muted,false);assert.equal(output.muted,false);
 output.apply();assert.equal(musicMuted,true,'new song or playing event cannot unmute zero music');
 output.setVolume('music',50);assert.equal(musicMuted,false);
 output.setVolume('voice',0);assert.equal(voice.muted,true);assert.equal(musicMuted,false);
 output.setVolume('voice',100);assert.equal(voice.muted,false);
});

test('entering the room enables sound despite an old mute, restores zero levels and respects later manual mute',()=>{
 const saved=new Map([['rap-muted','1'],['rap-music-volume','0'],['rap-voice-volume','0']]);
 let plays=0,paused=true;const audio={play(){plays++;return Promise.resolve();}};
 const output=createAudioOutput({storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},getPlayer:()=>({setVolume(){},unMute(){},mute(){},playVideo(){throw Error('must not start a paused song');}}),canPlay:()=>!paused,getAudio:()=>[audio]});
 assert.equal(output.muted,false);output.enable({restoreSilentLevels:true});
 assert.equal(saved.get('rap-muted'),'0');assert.equal(output.musicVolume,30);assert.equal(output.voiceVolume,100);assert.equal(plays,1);assert.equal(audio.muted,false);
 output.toggle();assert.equal(output.muted,true);output.apply();assert.equal(audio.muted,true,'room snapshots do not override a new manual mute');
});

test('music starts at 30 percent and voice at full volume; independent levels survive reload and new peers',()=>{
 const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 let music=-1,plays=0;const voices=[{muted:false,volume:0}],player={setVolume(value){music=value;},mute(){},unMute(){},playVideo(){plays++;}};
 const output=createAudioOutput({storage,getPlayer:()=>player,getAudio:()=>voices});
 output.apply();assert.equal(music,30);assert.equal(voices[0].volume,1);
 output.setVolume('music',15);assert.equal(music,15);assert.equal(voices[0].volume,1);
 output.setVolume('voice',65);assert.equal(music,15);assert.equal(voices[0].volume,.65);
 const nextVoice={};output.attach(nextVoice);assert.equal(nextVoice.volume,.65);assert.equal(nextVoice.muted,false);
 const restored=createAudioOutput({storage});assert.equal(restored.musicVolume,15);assert.equal(restored.voiceVolume,65);
 output.apply();assert.equal(music,15,'song changes retain the selected music level');assert.equal(plays,0,'sliders never start a paused video');
});

test('zero and mute remain independent, invalid values are bounded and storage failure is harmless',()=>{
 const saved=new Map([['rap-music-volume','0'],['rap-voice-volume','invalid']]),audio={};let music;
 const output=createAudioOutput({storage:{getItem:key=>saved.get(key),setItem(){throw Error('storage blocked');}},getPlayer:()=>({setVolume:v=>music=v,mute(){},unMute(){}}),getAudio:()=>[audio]});
 assert.equal(output.musicVolume,0);assert.equal(output.voiceVolume,100);
 output.apply();assert.equal(music,0);output.toggle();assert.equal(audio.muted,true);
 output.setVolume('music',-20);assert.equal(output.musicVolume,0);assert.equal(output.muted,true);
 output.setVolume('voice',500);assert.equal(audio.volume,1);assert.equal(audio.muted,true);
 output.setVolume('voice',0);assert.equal(audio.volume,0);
 output.setVolume('music',NaN);assert.equal(output.musicVolume,0);
 output.setVolume('voice','no');assert.equal(output.voiceVolume,0);
 const blocked=createAudioOutput({storage:{getItem(){throw Error('blocked');}}});assert.equal(blocked.musicVolume,30);assert.equal(blocked.voiceVolume,100);
});
