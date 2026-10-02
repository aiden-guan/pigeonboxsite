// Reusable authored details for the courier's miniature sets.
import * as THREE from '../vendor/three.min.js';
import { beveledBox, canopyGeometry, merge } from './geometry.js';
import { stylizedMat, glassMat } from './materials.js';

const palette = {
  cream: stylizedMat('#eadcc2'), wood: stylizedMat('#805c45'),
  copper: stylizedMat('#72968a', {metalness:.25,roughness:.55}),
  terra: stylizedMat('#b87555'), leaf: stylizedMat('#74885a'),
  glass: glassMat('#435e65'), ink: stylizedMat('#354b50'),
  parcel: stylizedMat('#cba775'), tape: stylizedMat('#eee1c0'),
};

export function block(parent, dimensions, position, material = palette.cream, radius = .06) {
  const mesh = new THREE.Mesh(beveledBox(...dimensions, radius), material);
  mesh.position.set(...position); parent.add(mesh); return mesh;
}

export function rod(parent, a, b, radius = .05, material = palette.copper) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),10),material);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  parent.add(mesh); return mesh;
}

export function archedPanel(width,height,depth=.12) {
  const r=width/2, y=height-r, shape=new THREE.Shape();
  shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,y);
  shape.absarc(0,y,r,0,Math.PI,false);shape.lineTo(-r,0);
  return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,steps:1,curveSegments:12});
}

export function windowFrame(parent,x,y,z,w=1,h=1.5,rotation=0) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=rotation;
  const surround=new THREE.Mesh(archedPanel(w+.25,h+.15),palette.cream);
  const pane=new THREE.Mesh(archedPanel(w,h,.08),palette.glass);pane.position.set(0,.07,.14);
  group.add(surround,pane);
  block(group,[.075,h-.15,.08],[0,h/2,.27]);
  block(group,[w,.075,.08],[0,h*.48,.27]);
  block(group,[w+.45,.16,.45],[0,-.02,.16]);
  parent.add(group);return group;
}

export function planter(parent,x,y,z,scale=1) {
  const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);
  const pot=new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.32,0],[.4,.1],[.49,.75],[.54,.77],[.54,.88],[.43,.88],[.42,.72],[.3,.12],[0,.12]].map(p=>new THREE.Vector2(...p)),16),palette.terra);
  const foliage=new THREE.Mesh(canopyGeometry(),palette.leaf);foliage.scale.set(.48,.42,.48);foliage.position.y=.36;
  group.add(pot,foliage);parent.add(group);return group;
}

export function parcel(parent,x,y,z,scale=1) {
  const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);
  block(group,[.9,.65,.7],[0,.325,0],palette.parcel);
  block(group,[.12,.67,.72],[0,.325,0],palette.tape,.01);
  block(group,[.32,.19,.02],[.2,.4,.36],palette.cream,.01);
  parent.add(group);return group;
}

export function bench(parent,x,y,z,rotation=0) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=rotation;
  for(const a of [-.85,.85]){
    block(group,[.14,.9,.7],[a,.45,0],palette.ink);
    block(group,[.14,1.35,.14],[a,1.05,-.34],palette.ink);
  }
  for(let i=0;i<3;i++){
    block(group,[2.2,.12,.2],[0,.95,-.22+i*.22],palette.wood);
    block(group,[2.2,.2,.12],[0,1.25+i*.23,-.34],palette.wood);
  }
  parent.add(group);return group;
}

export function bicycle(parent,x,y,z,rotation=0) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=rotation;
  for(const cx of [-.65,.65]){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.46,.045,6,24),palette.ink);
    wheel.position.set(cx,.5,0);group.add(wheel);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(group,[cx,.5,0],[cx+Math.cos(a)*.43,.5+Math.sin(a)*.43,0],.012,palette.cream);}
  }
  for(const [a,b] of [[[-.65,.5,0],[-.25,1.15,0]],[[-.25,1.15,0],[.1,.5,0]],[[.1,.5,0],[-.65,.5,0]],[[-.25,1.15,0],[.45,1.15,0]],[[.45,1.15,0],[.1,.5,0]],[[.45,1.15,0],[.65,.5,0]],[[.45,1.15,0],[.4,1.45,0]]])rod(group,a,b,.035,palette.copper);
  block(group,[.34,.08,.20],[-.26,1.2,0],palette.wood);
  rod(group,[.4,1.45,-.22],[.4,1.45,.22],.035,palette.ink);
  parcel(group,-.72,1.03,0,.65);
  parent.add(group);return group;
}

// Bake static sibling meshes by material. Designed details cost geometry,
// rather than a draw call for every roof tile, spoke or planter rim.
export function batchStatic(group) {
  const buckets=new Map();
  group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert();
  const meshes=[];
  group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material))meshes.push(o);});
  for(const mesh of meshes){
    const geometry=mesh.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);
    buckets.get(mesh.material).push(geometry);
    mesh.removeFromParent();
  }
  for(const [material,parts] of buckets){
    const mesh=new THREE.Mesh(merge(parts),material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    parts.forEach(p=>p.dispose());
  }
  return group;
}

export { palette };
