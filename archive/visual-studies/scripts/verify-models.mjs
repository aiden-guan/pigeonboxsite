import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three.min.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { createPigeon } from '../journey/pigeon.js';
import { buildMonuments } from '../journey/monuments.js';
import { adoptModelGeometry } from '../journey/assets.js';
import { STOPS } from '../journey/layout.js';

const loader = new GLTFLoader();
const bird = createPigeon();
const monuments = buildMonuments(new THREE.Scene());
const cases = [{root:bird.root,file:'pigeon/courier.glb'},...monuments.map((m,i)=>({root:m.group,file:`landmarks/${STOPS[i].id}.glb`}))];
for (const {root,file} of cases) {
  const bytes = await readFile(new URL(`../assets/models/${file}`,import.meta.url));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const count = adoptModelGeometry(root,gltf.scene);
  root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(const n of p.array)if(!Number.isFinite(n))throw new Error(`${file}: invalid position`);}});
  console.log(`${file}: ${count} parts adopted`);
}
for(const fold of [0,.5,1])bird.update(1/60,{fold,flap:1-fold,landing:1-fold,legs:fold,look:.2});
const env={clockMinutes:720,night:1,arrived:true};
monuments.forEach(m=>{m.update(1,env);if(!Number.isFinite(m.perchY))throw new Error('Invalid perch');});
console.log('All eight assets parsed, bound, and animated.');
