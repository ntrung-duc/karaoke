const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function movieSlug(value){
 if(typeof value!=='string'||value.length>500)return null;
 let slug=value.trim();
 if(/^https?:\/\//i.test(slug)){
  try{const url=new URL(slug);if(!/^(?:www\.)?kkphim\d*\.com$/.test(url.hostname)&&url.hostname!=='phimapi.com')return null;slug=url.pathname.match(/^\/phim\/([a-z0-9-]+)\/?$/)?.[1]||'';}catch{return null;}
 }
 return slug.length<=180&&SLUG.test(slug)?slug:null;
}
function https(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function createMovieCatalog({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map();
 async function read(path){
  const saved=cache.get(path);if(saved&&saved.until>now())return saved.value;
  const response=await fetchImpl('https://phimapi.com'+path,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{accept:'application/json'}});
  if(!response.ok)throw new Error('Nguồn phim đang lỗi. Hãy thử lại sau.');
  const value=await response.json();if(value.status===false||value.status==='error')throw new Error('Không tìm thấy phim.');
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(path,{value,until:now()+300000});return value;
 }
 return {
  async search(query){
   if(typeof query!=='string'||query.trim().length<2||query.length>100)throw new Error('Nhập tên phim từ 2–100 ký tự.');
   const raw=await read('/v1/api/tim-kiem?keyword='+encodeURIComponent(query.trim())+'&limit=10');
   return (raw.data?.items||[]).filter(item=>movieSlug(item.slug)).slice(0,10).map(item=>({slug:item.slug,title:String(item.name||'Phim').slice(0,180),year:item.year,poster:https(item.thumb_url)||null}));
  },
  async detail(input){
   const slug=movieSlug(input);if(!slug)throw new Error('Dán link phim KKPhim hoặc chọn phim trong kết quả.');
   const raw=await read('/phim/'+slug),movie=raw.movie;
   if(!movie)throw new Error('Không tìm thấy thông tin phim.');
   const episodes=[];
   for(const [serverIndex,server] of (raw.episodes||[]).entries())for(const [episodeIndex,entry] of (server.server_data||[]).entries()){
    const source=https(entry.link_m3u8);if(!source||!new URL(source).pathname.endsWith('.m3u8'))continue;
    episodes.push({id:serverIndex+':'+episodeIndex,name:String(entry.name||entry.slug||'Full').slice(0,80),server:String(server.server_name||'Vietsub').slice(0,80),source});
    if(episodes.length>=2000)break;
   }
   if(!episodes.length)throw new Error('Phim này chưa có nguồn HLS phát được.');
   return {slug,title:String(movie.name||'Phim').slice(0,180),poster:https(movie.thumb_url),episodes};
  }
 };
}
