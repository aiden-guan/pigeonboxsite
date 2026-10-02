// Reproducible authored model build. No browser, network or rendering required.
// Shapes and construction details live in journey/{pigeon,monuments,craft}.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../vendor/three.min.js';
import { createPigeon } from '../journey/pigeon.js';
import { buildMonuments } from '../journey/monuments.js';
import { STOPS } from '../journey/layout.js';
import { mergeVertices } from '../vendor/addons/utils/BufferGeometryUtils.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function encodeGLB(scene) {
  const json={asset:{version:'2.0',generator:'PigeonBox miniature model workshop'},scene:0,scenes:[{nodes:[0]}],nodes:[],meshes:[],materials:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
  const buffers=[], materials=new Map(), geometries=new Map();
  let bytes=0, triangles=0;
  function accessor(array,type,componentType,target,bounds=false){
    const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    const view=json.bufferViews.length;
    json.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length,target});
    buffers.push(data);bytes+=data.length;
    const pad=(4-bytes%4)%4;if(pad){buffers.push(Buffer.alloc(pad));bytes+=pad;}
    const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type];
    const record={bufferView:view,componentType,count:array.length/size,type};
    if(bounds){record.min=Array(size).fill(Infinity);record.max=Array(size).fill(-Infinity);for(let i=0;i<array.length;i++){const k=i%size;record.min[k]=Math.min(record.min[k],array[i]);record.max[k]=Math.max(record.max[k],array[i]);}}
    json.accessors.push(record);return json.accessors.length-1;
  }
  function material(mat){
    if(materials.has(mat))return materials.get(mat);
    const record={name:mat.name||`surface_${materials.size}`,pbrMetallicRoughness:{baseColorFactor:[...mat.color.toArray(),mat.opacity],metallicFactor:mat.metalness??0,roughnessFactor:mat.roughness??.9},doubleSided:mat.side===THREE.DoubleSide};
    if(mat.emissive)record.emissiveFactor=mat.emissive.clone().multiplyScalar(mat.emissiveIntensity??1).toArray().map(v=>Math.min(1,v));
    if(mat.transparent)record.alphaMode='BLEND';
    if(mat.userData.window)record.extras={window:mat.userData.window};
    const index=json.materials.length;json.materials.push(record);materials.set(mat,index);return index;
  }
  function geometry(geo){
    if(geometries.has(geo))return geometries.get(geo);
    const source=geo;
    if(!geo.index)geo=mergeVertices(geo,1e-5);
    const attributes={POSITION:accessor(geo.attributes.position.array,'VEC3',5126,34962,true),NORMAL:accessor(geo.attributes.normal.array,'VEC3',5126,34962)};
    if(geo.attributes.color)attributes.COLOR_0=accessor(geo.attributes.color.array,'VEC3',5126,34962);
    if(geo.attributes.uv)attributes.TEXCOORD_0=accessor(geo.attributes.uv.array,'VEC2',5126,34962);
    const result={attributes};
    if(geo.index)result.indices=accessor(geo.index.array,'SCALAR',geo.index.array instanceof Uint32Array?5125:5123,34963);
    geometries.set(source,result);return result;
  }
  function visit(object,route){
    const node={name:`part_${route}`,translation:object.position.toArray(),rotation:object.quaternion.toArray(),scale:object.scale.toArray()};
    const index=json.nodes.length;json.nodes.push(node);
    if(object.isMesh){
      let geo=object.geometry;
      if(object.isInstancedMesh){
        const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
        const positions=new Float32Array(object.count*3),rotations=new Float32Array(object.count*4),scales=new Float32Array(object.count*3);
        for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);position.toArray(positions,i*3);rotation.toArray(rotations,i*4);scale.toArray(scales,i*3);}
        node.extensions={EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:accessor(positions,'VEC3',5126,34962),ROTATION:accessor(rotations,'VEC4',5126,34962),SCALE:accessor(scales,'VEC3',5126,34962)}}};
        json.extensionsUsed=['EXT_mesh_gpu_instancing'];json.extensionsRequired=['EXT_mesh_gpu_instancing'];
      }
      const mats=Array.isArray(object.material)?object.material:[object.material];
      if(mats.length!==1)throw new Error('Workshop export expects single-material meshes');
      json.meshes.push({primitives:[{...geometry(geo),material:material(mats[0])}]});node.mesh=json.meshes.length-1;
      triangles+=(geo.index?.count??geo.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);
    }
    if(object.children.length)node.children=object.children.map((child,i)=>visit(child,`${route}_${i}`));
    return index;
  }
  visit(scene,'0');json.buffers[0].byteLength=bytes;
  let text=Buffer.from(JSON.stringify(json));const padding=(4-text.length%4)%4;if(padding)text=Buffer.concat([text,Buffer.alloc(padding,32)]);
  const binary=Buffer.concat(buffers),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+binary.length,8);
  jh.writeUInt32LE(text.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
  return {data:Buffer.concat([header,jh,text,bh,binary]),triangles,draws:json.meshes.length};
}

const pigeon=createPigeon();
// Export neutral pivots; runtime animation remains driven by the flight states.
const scene=new THREE.Scene(),landmarks=buildMonuments(scene);
const models=[{file:'pigeon/courier.glb',group:pigeon.root},...landmarks.map((m,i)=>({file:`landmarks/${STOPS[i].id}.glb`,group:m.group,perchY:m.perchY}))];
const manifest=[];
for(const model of models){
  const result=encodeGLB(model.group),file=path.join(root,'assets/models',model.file);
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,result.data);
  manifest.push({file:model.file,bytes:result.data.length,triangles:result.triangles,draws:result.draws,...(model.perchY===undefined?{}:{perchY:model.perchY})});
}
await fs.writeFile(path.join(root,'assets/models/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
