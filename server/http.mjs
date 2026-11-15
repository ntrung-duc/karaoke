import {readFile} from 'node:fs/promises';

// Explicit public surface: never serve project source, secrets or source downloads.
const files = new Map([
  ...['index.html', 'app.js', 'connection.js', 'hall.js', 'camera-controls.js', 'player-state.js', 'input.js', 'scenery.js', 'graffiti.js', 'recliner.js', 'navigation.js', 'avatar.js', 'avatar-head.js', 'block-avatar.js', 'toy-avatar.js', 'faces.js', 'avatar-settings.js', 'motion.js', 'session.js', 'layout.js', 'style.css']
    .map(file => ['/' + file, 'public/' + file]),
  ['/', 'public/index.html'],
  ['/assets/mannequin.glb', 'public/assets/mannequin.glb'],
  ['/assets/face-atlas.png', 'public/assets/face-atlas.png'],
  ['/assets/human-motions.json', 'public/assets/human-motions.json'],
  ...['three.module.js', 'three.core.js'].map(file => ['/lib/' + file, 'node_modules/three/build/' + file]),
  ['/lib/css.js', 'node_modules/three/examples/jsm/renderers/CSS3DRenderer.js'],
  ...['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js']
    .map(file => ['/lib/' + file, 'node_modules/three/examples/jsm/' + file]),
]);
const types = {
  js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
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
