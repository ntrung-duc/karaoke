import {WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
import {seats, position, clearSeat} from '../public/layout.js';
import {gaits, jumpPose} from '../public/motion.js';
import {MAX_QUEUE, MAX_NAME, MAX_TITLE} from '../public/session.js';
import {isFace,isSkin,wrapYaw} from '../public/avatar-settings.js';

const resetMotion = {gait: 'idle', movingUntil: 0, jumpAt: 0};

// Each application owns its rooms; tests and future instances do not share globals.
export function createRoomService({ice = []} = {}) {
  const rooms = new Map();

  function send(client, message) {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  }

  function broadcast(room, message) {
    for (const {client} of room.users.values()) send(client, message);
  }

  function publish(room) {
    broadcast(room, {
      type: 'state', users: [...room.users.values()].map(user => user.data),
      queue: room.queue, song: room.song, now: Date.now(),
    });
  }

  function advance(room) {
    const previous = room.users.get(room.song?.owner)?.data;
    if (previous) Object.assign(previous, {
      x: 0, z: -1, seat: -1, mic: false, yaw: 0, bodyYaw:0, pitch: 0, ...resetMotion,
    });
    room.song = room.queue.shift() || null;
    if (room.song) {
      room.song.start = Date.now() + 1200;
      Object.assign(room.users.get(room.song.owner).data, {
        x: 0, z: -4, seat: -1, yaw: Math.PI, bodyYaw:Math.PI, pitch: 0, ...resetMotion,
      });
    }
  }

  function move(room, data, message, singer) {
    const {x, z, yaw, pitch, gait} = message;
    if (![x, z, yaw, pitch].every(Number.isFinite)) return;
    const target = position(x, z, singer);
    const allowed = data.seat < 0 && (singer || clearSeat(target.x, target.z));
    const moved = allowed && Math.hypot(target.x - data.x, target.z - data.z) > .0001;
    if (allowed) Object.assign(data, target);
    data.gait = moved && gaits.has(gait) ? gait : 'idle';
    data.movingUntil = moved ? Date.now() + 240 : 0;
    data.yaw = wrapYaw(yaw);
    data.pitch = Math.min(1, Math.max(-1, pitch));
    broadcast(room, {type: 'pose', user: data});
  }

  function changeSeat(room, data, index) {
    if (index === -1 && data.seat >= 0) {
      data.seat = -1;
      data.z -= .83;
    } else if (Number.isInteger(index) && seats[index]
      && ![...room.users.values()].some(user => user.data.seat === index)) {
      Object.assign(data, {seat: index, ...seats[index]});
    } else return false;
    Object.assign(data, resetMotion);
    return true;
  }

  function handleMessage(room, data, raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (!message || typeof message !== 'object') return;
    const singer = room.song?.owner === data.id;
    switch (message.type) {
      case 'move':
        move(room, data, message, singer);
        return;
      case 'jump':
        if (data.seat >= 0 || jumpPose(data.jumpAt, Date.now()).state) return;
        data.jumpAt = Date.now();
        broadcast(room, {type: 'pose', user: data});
        return;
      case 'signal': {
        const peer = room.users.get(message.to);
        if (peer && (singer || message.to === room.song?.owner)) {
          send(peer.client, {type: 'signal', from: data.id, signal: message.signal});
        }
        return;
      }
      case 'name':
        data.name = String(message.value || 'Khách').trim().slice(0, MAX_NAME) || 'Khách';
        break;
      case 'appearance':
        if(message.face!==undefined&&!isFace(message.face)||message.skin!==undefined&&!isSkin(message.skin))return;
        if(message.face===undefined&&message.skin===undefined)return;
        if(message.face!==undefined)data.face=message.face;
        if(message.skin!==undefined)data.skin=message.skin;
        break;
      case 'seat':
        if (singer || !changeSeat(room, data, message.index)) return;
        break;
      case 'queue':
        if (typeof message.video !== 'string' || !/^[\w-]{11}$/.test(message.video)
          || room.queue.length >= MAX_QUEUE) return;
        room.queue.push({
          owner: data.id, video: message.video,
          title: String(message.title || 'Bài hát YouTube').slice(0, MAX_TITLE), key: randomUUID(),
        });
        if (!room.song) advance(room);
        break;
      case 'next':
        if (!singer || message.key !== room.song.key) return;
        advance(room);
        break;
      case 'mic':
        if (!singer) return;
        data.mic = !!message.on;
        break;
      default:
        return;
    }
    publish(room);
  }

  function join(client, key) {
    let room = rooms.get(key);
    if (!room) {
      room = {users: new Map(), queue: [], song: null};
      rooms.set(key, room);
    }
    const id = randomUUID();
    const seat = seats.findIndex((_, index) => ![...room.users.values()].some(user => user.data.seat === index));
    const data = {
      id, name: 'Khách', seat, ...(seats[seat] || {x: 0, z: 11}),
      yaw: 0, bodyYaw:0, pitch: 0, face:0, skin:0, color: Math.floor(Math.random() * 6), mic: false, ...resetMotion,
    };
    room.users.set(id, {client, data});
    send(client, {type: 'hello', id, ice});
    publish(room);
    client.on('error', () => client.terminate());
    client.on('message', raw => handleMessage(room, data, raw));
    client.on('close', () => {
      room.users.delete(id);
      room.queue = room.queue.filter(song => song.owner !== id);
      if (room.song?.owner === id) advance(room);
      if (room.users.size) publish(room);
      else rooms.delete(key);
    });
  }

  return {join};
}
