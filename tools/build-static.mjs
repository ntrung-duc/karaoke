import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),output=new URL('dist/',root);
if(output.href!==root.href+'dist/')throw new Error('Build output must be the project dist directory');
// This fixed, project-owned build directory contains generated files only.
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp(new URL('public/',root),output,{recursive:true});
for(const [source,target] of [
 ['build/three.module.js','three.module.js'],['build/three.core.js','three.core.js'],
 ['examples/jsm/renderers/CSS3DRenderer.js','css.js'],
 ['examples/jsm/utils/BufferGeometryUtils.js','utils/BufferGeometryUtils.js'],
 ['examples/jsm/utils/SkeletonUtils.js','utils/SkeletonUtils.js'],
 ['examples/jsm/loaders/GLTFLoader.js','loaders/GLTFLoader.js'],
]){
 const destination=new URL(`lib/${target}`,output);await mkdir(new URL('./',destination),{recursive:true});
 await cp(new URL(`node_modules/three/${source}`,root),destination);
}
await cp(new URL('node_modules/livekit-client/dist/livekit-client.esm.mjs',root),new URL('lib/livekit-client.js',output));
console.log(`Static assets ready: ${fileURLToPath(output)}`);
