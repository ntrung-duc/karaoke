import {readFile} from 'node:fs/promises';

// Explicit public surface: never serve project source, secrets or source downloads.
const files = new Map([
  ...['index.html', 'app.js', 'connection.js', 'audio-output.js', 'playback.js', 'chat.js', 'youtube-search.js', 'hall.js', 'camera-controls.js', 'player-state.js', 'input.js', 'render-budget.js', 'scenery.js', 'recliner.js', 'navigation.js', 'avatar.js', 'roblox-avatar.js', 'avatar-head.js', 'block-avatar.js', 'toy-avatar.js', 'faces.js', 'avatar-settings.js', 'motion.js', 'session.js', 'layout.js', 'style.css']
    .map(file => ['/' + file, 'public/' + file]),
  ['/', 'public/index.html'],
  ['/server-clock.js', 'public/server-clock.js'],
  ['/flowers.js', 'public/flowers.js'],
  ['/animal-preview.js', 'public/animal-preview.js'],
  ['/animal-settings.js', 'public/animal-settings.js'],
  ['/animal-avatar.js', 'public/animal-avatar.js'],
  ['/turn-state.js', 'public/turn-state.js'],
  ['/song-queue.js', 'public/song-queue.js'],
  ['/room-host.js', 'public/room-host.js'],
  ['/tiktok-chat.js', 'public/tiktok-chat.js'],
  ['/werewolf.js', 'public/werewolf.js'],
  ['/werewolf-rules.js', 'public/werewolf-rules.js'],
  ['/werewolf-scene.js', 'public/werewolf-scene.js'],
  ['/movies.js', 'public/movies.js'],
  ['/movie-state.js', 'public/movie-state.js'],
  ['/movie-player.js', 'public/movie-player.js'],
  ['/lib/hls.mjs', 'node_modules/hls.js/dist/hls.mjs'],
  ['/lib/hls.worker.js', 'node_modules/hls.js/dist/hls.worker.js'],
  ['/livekit-voice.js', 'public/livekit-voice.js'],
  ['/lib/livekit-client.js', 'node_modules/livekit-client/dist/livekit-client.esm.mjs'],
  ['/singer-mic.js', 'public/singer-mic.js'],
  ['/voice-chain.js', 'public/voice-chain.js'],
  ['/singer-layout.js', 'public/singer-layout.js'],
  ['/mobile-controls.js', 'public/mobile-controls.js'],
  ['/mic-test.js', 'public/mic-test.js'],
  ['/mic-test-panel.js', 'public/mic-test-panel.js'],
  ['/emotes.js', 'public/emotes.js'],
  ['/wolf-dance.js', 'public/wolf-dance.js'],
  ['/assets/wolf-dance.json', 'public/assets/wolf-dance.json'],
  ['/assets/roblox-noob.glb', 'public/assets/roblox-noob.glb'],
  ['/assets/mannequin.glb', 'public/assets/mannequin.glb'],
  ['/assets/face-atlas.png', 'public/assets/face-atlas.png'],
  ['/assets/rear-wall-mural.png', 'public/assets/rear-wall-mural.png'],
  ['/assets/parker-dance.json', 'public/assets/parker-dance.json'],
  ['/assets/human-motions.json', 'public/assets/human-motions.json'],
  ...['three.module.js', 'three.core.js'].map(file => ['/lib/' + file, 'node_modules/three/build/' + file]),
  ['/lib/css.js', 'node_modules/three/examples/jsm/renderers/CSS3DRenderer.js'],
  ...['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js']
    .map(file => ['/lib/' + file, 'node_modules/three/examples/jsm/' + file]),
]);
const types = {
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8', glb: 'model/gltf-binary', png: 'image/png', html: 'text/html; charset=utf-8',
};
export async function serveStatic(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, {Allow: 'GET, HEAD'}).end(); return;
  }
  let path;
  try { path = new URL(req.url, 'http://localhost').pathname; }
  catch { res.writeHead(400).end(); return; }
  if (path === '/healthz') {
    const body = JSON.stringify({status: 'ok'});
    res.writeHead(200, {'Content-Type': types.json, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body)});
    res.end(req.method === 'HEAD' ? undefined : body);return;
  }
  const file = files.get(path);
  if (!file) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(new URL('../' + file, import.meta.url));
    res.writeHead(200, {
      'Content-Type': types[file.split('.').pop()] || 'application/octet-stream',
      'Content-Length': body.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    }).end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error('Không đọc được tài nguyên:', file, error.code);
    res.writeHead(500).end();
  }
}
