export function moviePosition(movie,now){return Math.max(0,Math.min(movie?.duration||86400,(movie?.position||0)+(movie&&!movie.paused?Math.max(0,now-movie.updatedAt)/1000:0)));}
