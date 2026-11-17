import {EventEmitter} from 'node:events';
import {createClient} from 'redis';
import {encodeRoom,decodeRoom} from './room-state.mjs';

export function createMemoryBackend(){return {rooms:new Map(),events:new EventEmitter().setMaxListeners(0)};}
export function createMemoryStore(backend=createMemoryBackend()){
 const cleanups=new Set();
 return {
  async ready(){},
  async transact(key,mutate){
   // No await inside the in-process transaction, matching Redis CAS semantics.
   const room=decodeRoom(backend.rooms.get(key));room.revision++;
   const result=mutate(room);backend.rooms.set(key,encodeRoom(room));
   for(const event of result.events||[])backend.events.emit(key,event);
   return result;
  },
  async subscribe(key,listener){
   backend.events.on(key,listener);
   const stop=()=>{backend.events.off(key,listener);cleanups.delete(stop);};cleanups.add(stop);return stop;
  },
  onUnavailable(){return ()=>{};},
  async close(){for(const stop of [...cleanups])stop();},
 };
}

// Compare-and-set + event publication form one Redis transaction. No distributed
// lock to expire, and two instances cannot allocate the same seat or lose a queue update.
const COMMIT=`
 local previous=redis.call('GET',KEYS[1]) or ''
 if previous~=ARGV[1] then return 0 end
 redis.call('SET',KEYS[1],ARGV[2],'EX',86400)
 local events=cjson.decode(ARGV[3])
 for _,event in ipairs(events) do redis.call('PUBLISH',KEYS[2],cjson.encode(event)) end
 return 1
`;
export function createRedisStore({url,prefix='karaoke:v1'}={}){
 if(!url||!/^rediss?:\/\//.test(url))throw new Error('REDIS_URL must use redis:// or rediss://');
 const options={url,disableOfflineQueue:true,socket:{connectTimeout:5000,reconnectStrategy:attempt=>Math.min(2000,100*2**Math.min(attempt,5))}};
 const client=createClient(options),subscriber=client.duplicate(),unavailable=new Set(),subscriptions=new Map();
 let connecting,closed=false;const transactions=new Map();
 for(const connection of [client,subscriber]){
  // Do not log connection errors: providers sometimes include credentials in them.
  connection.on('error',()=>{});
  connection.on('reconnecting',()=>{for(const callback of unavailable)callback();});
 }
 const channel=key=>`${prefix}:{${key}}:events`,roomKey=key=>`${prefix}:{${key}}:state`;
 async function ready(){
  if(closed)throw new Error('STORE_CLOSED');
  if(client.isReady&&subscriber.isReady)return;
  if(!connecting){
   let timeout;
   const connection=Promise.all([client.isOpen?Promise.resolve():client.connect(),subscriber.isOpen?Promise.resolve():subscriber.connect()]);
   const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('STORE_UNAVAILABLE')),7000);});
   connecting=Promise.race([connection,deadline]).catch(error=>{
    for(const c of [subscriber,client])if(c.isOpen)c.destroy();throw error;
   }).finally(()=>{clearTimeout(timeout);connecting=null;});
  }
  await connecting;
  if(!client.isReady||!subscriber.isReady)throw new Error('STORE_UNAVAILABLE');
 }
 return {
  ready,
  async loadRoom(key){await ready();return client.get(roomKey(key));},
  async saveRoom(key,raw){await ready();await client.set(roomKey(key),raw,{EX:86400});},
  async transact(key,mutate){
   // Serialize this instance's writers per room; CAS still protects other instances.
   const previousTask=transactions.get(key)||Promise.resolve();let release;
   const current=new Promise(resolve=>{release=resolve;});transactions.set(key,current);
   await previousTask;
   try{
   await ready();
   for(let attempt=0;attempt<24;attempt++){
    const previous=await client.get(roomKey(key)),room=decodeRoom(previous);room.revision++;
    const result=mutate(room);
    const committed=await client.eval(COMMIT,{keys:[roomKey(key),channel(key)],arguments:[previous||'',encodeRoom(room),JSON.stringify(result.events||[])]});
    if(committed===1)return result;
    await new Promise(resolve=>setTimeout(resolve,Math.min(25,attempt*2)+Math.random()*5));
   }
   throw new Error('ROOM_BUSY');
   }finally{release();if(transactions.get(key)===current)transactions.delete(key);}
  },
  async subscribe(key,listener){
   await ready();
   if(subscriptions.has(key))throw new Error('ROOM_ALREADY_SUBSCRIBED');
   subscriptions.set(key,listener);
   try{await subscriber.subscribe(channel(key),raw=>{
    try{listener(JSON.parse(raw));}catch{for(const callback of unavailable)callback();}
   });}catch(error){subscriptions.delete(key);throw error;}
   return async()=>{subscriptions.delete(key);if(subscriber.isReady)await subscriber.unsubscribe(channel(key));};
  },
  onUnavailable(callback){unavailable.add(callback);return ()=>unavailable.delete(callback);},
  async close(){closed=true;unavailable.clear();for(const c of [subscriber,client])if(c.isOpen)c.destroy();},
 };
}
