import http from 'node:http';
import {WebSocketServer} from 'ws';
import {serveStatic} from './http.mjs';
import {createRoomService} from './rooms.mjs';
import {roomName} from '../public/session.js';

export function createApplication(config) {
  const server = http.createServer(serveStatic);
  const websocket = new WebSocketServer({noServer: true, maxPayload: 32768});
  const rooms = createRoomService({ice: config.ice});
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const room = roomName(url.searchParams.get('room'));
      const sameOrigin = !req.headers.origin || new URL(req.headers.origin).host === req.headers.host;
      if (url.pathname !== '/live' || !room || !sameOrigin) { socket.destroy(); return; }
      websocket.handleUpgrade(req, socket, head, client => rooms.join(client, room));
    } catch { socket.destroy(); }
  });
  return {
    server,
    close() {
      for (const client of websocket.clients) client.terminate();
      websocket.close();
      return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
