import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {readConfig} from '../server/config.mjs';
import {roomName} from '../public/session.js';
import {FACES,isFace,faceIndex,relativeHeadYaw} from '../public/avatar-settings.js';
import {createMannequinHead} from '../public/avatar-head.js';

test('nine faces are bounded and head yaw supports every direction independently of body yaw',()=>{
  assert.equal(FACES.length,9);
  FACES.forEach((face,index)=>{
    assert.ok(isFace(index));assert.ok(face.name);
    const [x,y,w,h]=face.crop;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1280&&y+h<=1280);
  });
  for(const invalid of [-1,9,1.5,'2',null,NaN]){assert.equal(isFace(invalid),false);assert.equal(faceIndex(invalid),0);}
  assert.ok(Math.abs(relativeHeadYaw(Math.PI,0)-Math.PI)<1e-9);
  assert.ok(Math.abs(relativeHeadYaw(2*Math.PI,0))<1e-9);
  assert.ok(Math.abs(relativeHeadYaw(3*Math.PI/2,0)+Math.PI/2)<1e-9);
  assert.ok(Math.abs(relativeHeadYaw(0,Math.PI)+Math.PI)<1e-9);
});

test('configuration and room links fail clearly on invalid input', () => {
  assert.equal(readConfig({}).port, 4173);
  assert.equal(readConfig({PORT: '0'}).port, 0);
  assert.equal(readConfig({IP:'127.0.0.2'}).host,'127.0.0.2');
  assert.equal(readConfig({HOST:'127.0.0.1',IP:'127.0.0.2'}).host,'127.0.0.1');
  for (const PORT of ['abc', '-1', '65536', '1.5']) assert.throws(() => readConfig({PORT}));
  assert.equal(roomName(null), 'studio');
  assert.equal(roomName('lop-4_A'), 'lop-4_A');
  for (const name of ['phòng', 'a/b', 'a b', 'a'.repeat(49)]) assert.equal(roomName(name), null);
});

test('official mannequin has bound animation, independent skeletons and usable proportions', async () => {
  const glb = await readFile(new URL('../public/assets/mannequin.glb', import.meta.url));
  assert.equal(glb.readUInt32LE(0), 0x46546c67);
  assert.equal(glb.readUInt32LE(8), glb.length);
  const jsonSize = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonSize));
  assert.ok(json.images[0].uri.startsWith('data:image/png;base64,'));
  // Node has no image decoder; inspect geometry/skeleton with the same GLTF loader.
  for (const material of json.materials) delete material.pbrMetallicRoughness.baseColorTexture;
  const binaryStart = 20 + jsonSize + 8;
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + glb.subarray(binaryStart).toString('base64');
  globalThis.ProgressEvent ??= class ProgressEvent extends Event {
    constructor(type, options) { super(type); Object.assign(this, options); }
  };
  const data = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  assert.equal(data.animations.length, 21);
  const meshes = [];
  data.scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  assert.equal(meshes.length, 1);
  const copied = clone(data.scene), copyMesh = copied.getObjectByName(meshes[0].name);
  assert.notEqual(meshes[0].skeleton, copyMesh.skeleton);
  assert.notEqual(meshes[0].skeleton.bones[0], copyMesh.skeleton.bones[0]);
  const mixer = new T.AnimationMixer(data.scene);
  const warnings = [], originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    for (const clip of data.animations) {
      assert.ok(clip.validate());
      mixer.stopAllAction();mixer.clipAction(clip).play();mixer.update(.1);
      data.scene.updateMatrixWorld(true);
      meshes[0].computeBoundingBox();
      const bounds = meshes[0].boundingBox.clone().applyMatrix4(meshes[0].matrixWorld);
      assert.ok(bounds.max.y > .8 && bounds.max.y < 2.2, `${clip.name}: plausible height`);
      assert.ok(bounds.min.y > -.25, `${clip.name}: feet above the floor tolerance`);
    }
  } finally { console.warn = originalWarn; }
  assert.deepEqual(warnings, []);
  mixer.stopAllAction();mixer.clipAction(data.animations.find(clip=>clip.name==='idle')).play();mixer.update(0);
  const actor=new T.Group();actor.position.set(3,1,-4);actor.add(data.scene);actor.updateMatrixWorld(true);
  const head=data.scene.getObjectByName('B-head');
  const rounded=createMannequinHead(head,actor,new T.MeshStandardMaterial());
  const shell=rounded.getObjectByName('AvatarHeadShell');
  actor.updateMatrixWorld(true);
  const size=new T.Box3().setFromObject(shell).getSize(new T.Vector3());
  assert.ok(size.x>.20&&size.x<.23&&size.y>.26&&size.y<.28);
  const rest=head.quaternion.clone(),bodyPose=[];
  for(let vertex=0;vertex<meshes[0].geometry.attributes.position.count;vertex++)bodyPose.push(meshes[0].getVertexPosition(vertex,new T.Vector3()));
  for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]){
    head.quaternion.copy(rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw));
    actor.updateMatrixWorld(true);
    assert.equal(actor.rotation.y,0,'head look must not rotate the body');
    for(let vertex=0;vertex<bodyPose.length;vertex++)assert.ok(meshes[0].getVertexPosition(vertex,new T.Vector3()).distanceTo(bodyPose[vertex])<.00001,'rotating head must not pull neck/body vertices');
  }
});
