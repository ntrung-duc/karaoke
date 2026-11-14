import http from 'node:http';
import {WebSocketServer} from 'ws';
import {serveStatic} from './http.mjs';
import {createRoomService} from './rooms.mjs';
import {roomName} from '../public/session.js';

export function createApplication(config) {
  const server = http.createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/healthz'||path==='/api/live'){
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
      let healthy=true;try{await ready();}catch{healthy=false;}
      const body=JSON.stringify({status:healthy?'ok':'unavailable'});
      res.writeHead(healthy?200:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)}).end(req.method==='HEAD'?undefined:body);return;
    }
    return serveStatic(req,res);
  });
  const websocket = new WebSocketServer({noServer: true, maxPayload: 32768});
  const rooms = config.requireRedis&&!config.redisUrl&&!config.store?null:createRoomService(config);
  async function ready(){if(!rooms)throw new Error('REDIS_URL_REQUIRED');await rooms.ready();}
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if(!rooms){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');return;}
      const room = roomName(url.searchParams.get('room'));
      const sameOrigin = !req.headers.origin || new URL(req.headers.origin).host === req.headers.host;
      if (!['/live','/api/live'].includes(url.pathname) || !room || !sameOrigin) { socket.destroy(); return; }
      websocket.handleUpgrade(req, socket, head, client => {
        const timeout=setTimeout(()=>client.close(1008,'Join required'),10000);timeout.unref?.();
        client.once('close',()=>clearTimeout(timeout));
        client.once('error',()=>{});
        client.once('message',raw=>{
          clearTimeout(timeout);
          let hello;try{hello=JSON.parse(raw);}catch{client.close(1008,'Invalid join');return;}
          if(hello?.type!=='join'||hello.resumeToken!==undefined&&(typeof hello.resumeToken!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(hello.resumeToken))){client.close(1008,'Invalid join');return;}
          rooms.join(client,room,hello.resumeToken);
        });
      });
    } catch { socket.destroy(); }
  });
  return {
    server,
    ready,
    async close() {
      for (const client of websocket.clients) client.terminate();
      websocket.close();
      await rooms?.close();
      return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
