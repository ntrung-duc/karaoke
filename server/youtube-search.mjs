import {createHash,randomUUID} from 'node:crypto';

export class YouTubeSearchError extends Error {}
const CACHE_MS=15*60*1000,COOLDOWN_MS=4000,DAILY_LIMIT=90;
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
export const quotaDay=now=>dayFormatter.format(new Date(now));
export function searchQuery(value,karaoke=true){
 if(typeof value!=='string'||value.length>200)throw new YouTubeSearchError('Nhập tên bài hát từ 2 đến 100 ký tự.');
 const query=value.normalize('NFKC').replace(/\s+/g,' ').trim();
 if(query.length<2||query.length>100)throw new YouTubeSearchError('Nhập tên bài hát từ 2 đến 100 ký tự.');
 return karaoke&&!/\bkaraoke\b/i.test(query)?query+' karaoke':query;
}
export function searchItems(body){
 if(!Array.isArray(body.items))throw new YouTubeSearchError('YouTube trả về dữ liệu không hợp lệ. Thử lại sau nhé.');
 return body.items.filter(item=>/^[\w-]{11}$/.test(item.id?.videoId)&&typeof item.snippet?.title==='string').slice(0,10).map(item=>({
  video:item.id.videoId,title:item.snippet.title.slice(0,200),channel:String(item.snippet.channelTitle||'').slice(0,100),
  thumbnail:`https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
 }));
}

// This uses the same Redis CAS store as rooms, in an unreachable room namespace.
// Cache, in-flight locks and the daily budget therefore survive Vercel rotation.
export function createYouTubeSearch({store,apiKey,fetch:request=globalThis.fetch,now=Date.now}={}){
 const transact=mutate=>store.transact('internal:youtube-search',room=>{
  const time=now();room.search??={cache:{},locks:{},users:{},used:0};const data=room.search;
  for(const [key,value] of Object.entries(data.cache))if(value.until<=time)delete data.cache[key];
  for(const [key,value] of Object.entries(data.locks))if(value.until<=time)delete data.locks[key];
  for(const [key,value] of Object.entries(data.users))if(value<=time-COOLDOWN_MS)delete data.users[key];
  return mutate(data,time);
 });
 return async function search(user,value,karaoke){
  const query=searchQuery(value,karaoke);
  if(!apiKey)throw new YouTubeSearchError('Tìm kiếm YouTube chưa được bật. Bạn vẫn có thể dán liên kết video bên dưới.');
  const hash=createHash('sha256').update(query.toLocaleLowerCase('vi')).digest('hex'),token=randomUUID();
  const result=await transact((data,time)=>{
   if(data.cache[hash])return {items:data.cache[hash].items,cached:true};
   if(data.users[user])return {error:'Chờ 4 giây rồi tìm tiếp nhé.'};
   if(data.locks[hash])return {error:'Bài này đang được tìm. Chờ vài giây rồi thử lại nhé.'};
   const day=quotaDay(time);if(data.day!==day){data.day=day;data.used=0;}
   if(data.used>=DAILY_LIMIT)return {error:'Đã hết lượt tìm kiếm hôm nay. Bạn vẫn có thể dán liên kết YouTube.'};
   data.users[user]=time;data.used++;data.locks[hash]={token,until:time+15000};return {reserved:true};
  });
  if(result.error)throw new YouTubeSearchError(result.error);
  if(result.items)return {...result,query};
  try{
   const url=new URL('https://www.googleapis.com/youtube/v3/search');
   for(const [key,value] of Object.entries({part:'snippet',type:'video',q:query,maxResults:10,videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:'vi',regionCode:'VN',safeSearch:'moderate',key:apiKey}))url.searchParams.set(key,String(value));
   let response;
   try{response=await request(url,{signal:AbortSignal.timeout(8000)});}catch{throw new YouTubeSearchError('YouTube đang phản hồi chậm. Thử lại sau nhé.');}
   if(!response.ok){
    let reason;try{reason=(await response.json()).error?.errors?.[0]?.reason;}catch{}
    if(['quotaExceeded','dailyLimitExceeded'].includes(reason))throw new YouTubeSearchError('Đã hết lượt tìm kiếm YouTube hôm nay. Hãy dán liên kết video.');
    throw new YouTubeSearchError('Chưa tìm được trên YouTube. Thử lại sau hoặc dán liên kết video.');
   }
   let body;try{body=await response.json();}catch{throw new YouTubeSearchError('YouTube trả về dữ liệu không hợp lệ. Thử lại sau nhé.');}
   const items=searchItems(body);
   await transact((data,time)=>{
    if(data.locks[hash]?.token===token){data.cache[hash]={until:time+CACHE_MS,items};delete data.locks[hash];}
    return {};
   });
   return {items,query,cached:false};
  }finally{
   await transact(data=>{if(data.locks[hash]?.token===token)delete data.locks[hash];return {};});
  }
 };
}
