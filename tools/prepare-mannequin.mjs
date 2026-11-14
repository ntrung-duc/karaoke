// Convert the official FBX mannequin and its in-place clips to a self-contained GLB.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {motionSources} from './motion-sources.mjs';

const source = resolve(process.argv[2] || 'tools/source-assets/human-basic-motions-free');
// Exporter uses the browser FileReader interface, implemented with Node's Blob.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
// Embed the original palette below, avoiding a DOM/image decoder in the build.
T.TextureLoader.prototype.load = () => new T.Texture();
async function fbx(path) {
  const buffer = await readFile(resolve(source, path));
  return new FBXLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}
const model = await fbx('Models/HumanM_Model.fbx');
model.name = 'HumanMannequin';
model.updateMatrixWorld(true);
const headHeight=model.getObjectByName('B-head').getWorldPosition(new T.Vector3()).y;
model.traverse(object => {
  if (!object.isMesh) return;
  // Keep the official body/rig; the runtime supplies a smooth rigid head for
  // face decals and unrestricted turns, as requested by the project owner.
  const vertices=object.geometry.attributes.position,triangles=[];
  for(let vertex=0;vertex<vertices.count;vertex+=3){
    let height=0;
    for(let corner=0;corner<3;corner++)height+=new T.Vector3().fromBufferAttribute(vertices,vertex+corner).applyMatrix4(object.matrixWorld).y;
    if(height/3<headHeight-6)triangles.push(vertex,vertex+1,vertex+2);
  }
  object.geometry.setIndex(triangles);
  const skin=object.geometry.attributes.skinIndex;
  const neckIndex=object.skeleton.bones.findIndex(bone=>bone.name==='B-neck');
  for(let vertex=0;vertex<skin.count;vertex++)for(let component=0;component<4;component++){
    const name=object.skeleton.bones[skin.getComponent(vertex,component)]?.name;
    if(name==='B-head'||name==='B-jaw')skin.setComponent(vertex,component,neckIndex);
  }
  object.geometry = mergeVertices(object.geometry);
  object.normalizeSkinWeights();
  object.material = new T.MeshStandardMaterial({color: 0xffffff, roughness: .72});
});
const animations = [];
for (const [name, path] of Object.entries(motionSources)) {
  const rig = await fbx(`Animations/Male/${path}.fbx`);
  const clip = rig.animations[0];
  clip.name = name;
  // Source FBX skeleton names match the mannequin; preserve finger motion too.
  clip.tracks = clip.tracks.filter(track => model.getObjectByName(track.name.split('.')[0]));
  animations.push(clip.optimize());
}

// The free pack has no seated animation: build a grounded seated pose on its rig.
const mixer = new T.AnimationMixer(model);
// The in-place takeoff clip removes vertical root motion. Bake a ground offset
// so its feet do not sink into the hall during the anticipation phase.
const jump = animations.find(clip => clip.name === 'jump');
const root = model.getObjectByName('B-root');
const jumpAction = mixer.clipAction(jump).play();
const times = [], positions = [];
for (let frame = 0, frames = Math.ceil(jump.duration * 30); frame <= frames; frame++) {
  const time = Math.min(frame / 30, jump.duration - .000001);
  mixer.setTime(time); model.updateMatrixWorld(true);
  const bounds = new T.Box3().makeEmpty();
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    mesh.computeBoundingBox();bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  const lift = new T.Vector3(0, Math.max(0, -bounds.min.y), 0);
  lift.applyQuaternion(root.parent.getWorldQuaternion(new T.Quaternion()).invert());
  times.push(frame / 30);
  positions.push(...root.position.clone().add(lift).toArray());
}
jumpAction.stop();
jump.tracks = jump.tracks.filter(track => track.name !== 'B-root.position');
jump.tracks.push(new T.VectorKeyframeTrack('B-root.position', times, positions));
mixer.uncacheClip(jump);
mixer.clipAction(animations[0]).play();
mixer.update(0);
model.updateMatrixWorld(true);
function pointBone(name, direction) {
  const bone = model.getObjectByName(name);
  const world = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
  const parent = bone.parent.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(world));
  model.updateMatrixWorld(true);
}
const hips = model.getObjectByName('B-hips');
const target = new T.Vector3(0, 84, 0);
hips.position.copy(hips.parent.worldToLocal(target));
for (const side of ['L', 'R']) {
  pointBone('B-thigh' + side, new T.Vector3(0, 0, 1));
  pointBone('B-shin' + side, new T.Vector3(0, -1, 0));
  pointBone('B-foot' + side, new T.Vector3(0, -.15, 1));
  pointBone('B-upperArm' + side, new T.Vector3(0, -1, .15));
  pointBone('B-forearm' + side, new T.Vector3(0, -.65, .45));
}
const sitTracks = [];
model.traverse(bone => {
  if (!bone.isBone) return;
  sitTracks.push(new T.VectorKeyframeTrack(bone.name + '.position', [0], bone.position.toArray()));
  sitTracks.push(new T.QuaternionKeyframeTrack(bone.name + '.quaternion', [0], bone.quaternion.toArray()));
});
animations.push(new T.AnimationClip('sit', 1, sitTracks));
mixer.stopAllAction();
// Scene transform is outside every animation track: centimeters -> hall units, +Z -> -Z.
const wrapper = new T.Group();
wrapper.name = 'AvatarScale';
wrapper.scale.setScalar(.0092);
wrapper.rotation.y = Math.PI;
wrapper.add(model);
const raw = Buffer.from(await new GLTFExporter().parseAsync(wrapper, {
  binary: true, animations, onlyVisible: true,
  copyright: 'Kevin Iglesias — Human Basic Motions FREE; embedded project asset, not for standalone redistribution.',
}));

// Put the small original PNG inside the GLB JSON as a data URI.
const jsonLength = raw.readUInt32LE(12);
const json = JSON.parse(raw.subarray(20, 20 + jsonLength).toString('utf8'));
const png = await readFile(resolve(source, 'Textures/HumanAnimations_ColorPalette.png'));
json.images = [{uri: 'data:image/png;base64,' + png.toString('base64')}];
json.samplers = [{magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071}];
json.textures = [{source: 0, sampler: 0}];
for (const material of json.materials) material.pbrMetallicRoughness.baseColorTexture = {index: 0};
const encoded = Buffer.from(JSON.stringify(json));
const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
encoded.copy(padded);
const rest = raw.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + rest.length, 8);
header.writeUInt32LE(padded.length, 12);header.writeUInt32LE(0x4e4f534a, 16);
await mkdir('public/assets', {recursive: true});
const output = Buffer.concat([header, padded, rest]);
await writeFile('public/assets/mannequin.glb', output);
console.log(`Official mannequin: ${animations.length} clips, ${(output.length / 1024).toFixed(0)} KiB`);
