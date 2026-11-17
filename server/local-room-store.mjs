import {decodeRoom,encodeRoom,RESUME_GRACE_MS} from './room-state.mjs';
import {createMemoryBackend,createMemoryStore} from './room-store.mjs';

// Single Render process owns realtime state. Redis is a write-behind checkpoint,
// so a slow Redis round trip cannot stall movement, controls or microphone setup.
export function createLocalRoomStore(checkpoints,{intervalMs=2000}={}){
 const backend=createMemoryBackend(),memory=createMemoryStore(backend),loading=new Map(),dirty=new Map();
 let boot,flushTask,timer,closed=false;
 const ready=()=>boot??=checkpoints.ready().catch(error=>{boot=null;throw error;});
 async function load(key){
  if(backend.rooms.has(key))return;
  if(!loading.has(key))loading.set(key,(async()=>{await ready();const raw=await checkpoints.loadRoom(key);if(!backend.rooms.has(key)){const room=decodeRoom(raw);for(const member of room.users.values()){member.connectionId=null;member.expiresAt=Math.min(member.expiresAt,Date.now()+RESUME_GRACE_MS);member.data.mic=false;}backend.rooms.set(key,encodeRoom(room));}})().finally(()=>loading.delete(key)));
  await loading.get(key);
 }
 function schedule(){if(!closed&&!timer)timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},intervalMs);timer?.unref?.();}
 async function flush(){
  if(flushTask)return flushTask;
  flushTask=(async()=>{for(const [key,raw] of [...dirty]){
   try{await checkpoints.saveRoom(key,raw);if(dirty.get(key)===raw)dirty.delete(key);}
   catch{console.warn('Room checkpoint delayed; live room remains available');break;}
  }})().finally(()=>{flushTask=null;if(dirty.size)schedule();});
  return flushTask;
 }
 return {
  ready,
  async transact(key,mutate){await load(key);const result=await memory.transact(key,mutate);dirty.set(key,backend.rooms.get(key));schedule();return result;},
  async subscribe(key,listener){await load(key);return memory.subscribe(key,listener);},
  onUnavailable(){return ()=>{};},
  async close(){closed=true;clearTimeout(timer);await flushTask;await flush();await memory.close();await checkpoints.close();}
 };
}
