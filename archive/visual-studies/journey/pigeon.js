// A continuous articulated flight silhouette of overlapping sculpted feathers.
import * as THREE from '../vendor/three.min.js';
import { lerp } from './util.js';
import { stylizedMat } from './materials.js';
import { beveledBox } from './geometry.js';
const material = stylizedMat;
const silver=material('#aebfd0'),blue=material('#7c96b0'),charcoal=material('#435971');
const orb=new THREE.SphereGeometry(1,20,14), featherGeo=new THREE.SphereGeometry(1,12,8);
function sculpt(parent,mat,at,scale){const m=new THREE.Mesh(orb,mat);m.position.set(...at);m.scale.set(...scale);parent.add(m);return m;}
function plumage(parent,mat,feathers){
 const mesh=new THREE.InstancedMesh(featherGeo,mat,feathers.length),obj=new THREE.Object3D();
 feathers.forEach((f,i)=>{obj.position.set(...f.p);obj.scale.set(...f.s);obj.rotation.set(f.rx||0,f.a||0,f.rz||0);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);});
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function wing(side){
 const shoulder=new THREE.Group(),inner=new THREE.Group(),outer=new THREE.Group();
 // Broad overlapping feather masses form a single soft airfoil.
 sculpt(inner,silver,[.48*side,0,-.04],[.62,.105,.39]);
 sculpt(outer,blue,[.30*side,0,-.12],[.47,.085,.31]);
 plumage(outer,charcoal,Array.from({length:4},(_,i)=>({
   p:[(.25+i*.22)*side,-.025,-.24-i*.055],s:[.22,.065,.38-i*.025],a:-.35*side
 })));
 outer.position.x=.8*side;inner.add(outer);shoulder.add(inner);
 const folded=new THREE.Group();
 const cover=new THREE.Mesh(foldedWingGeometry(side),material('#ffffff',{vertexColors:true}));
 folded.add(cover);
 return {shoulder,inner,outer,folded,side};
}

function foldedWingGeometry(side){
 const rows=30,radial=24,p=[],c=[],idx=[];
 const grey=new THREE.Color('#9da9b1'),dark=new THREE.Color('#45535f');
 for(let j=0;j<=rows;j++){
   const t=j/rows,z=.23-t*.98;
   const fullness=Math.sin(Math.PI*t)**.65;
   const height=.30*fullness*(1-t*.35),thickness=.12*fullness;
   for(let i=0;i<=radial;i++){
     const a=i/radial*Math.PI*2;
     const feather=.008*Math.cos(t*40+a*2)*Math.sin(Math.PI*t);
     p.push(side*(.365+Math.cos(a)*(thickness+feather)),.11-t*.28+Math.sin(a)*height,z);
     const band=(t>.46&&t<.52)||(t>.66&&t<.72);
     const edge=Math.max(0,(t-.79)/.21);
     const shade=grey.clone().lerp(dark,band?.9:edge*.65);
     shade.multiplyScalar(1+feather*3);c.push(shade.r,shade.g,shade.b);
     if(j<rows&&i<radial){const k=j*(radial+1)+i;const f=[k,k+radial+1,k+1,k+1,k+radial+1,k+radial+2];if(side<0)f.reverse();idx.push(...f);}
   }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function beakGeometry(){
 const g=new THREE.SphereGeometry(1,20,10),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
   const z=p.getZ(i),t=(z+1)*.5;
   p.setXYZ(i,p.getX(i)*.067*(1-t*.65),p.getY(i)*.048*(1-t*.5)-t*t*.035,z*.105);
 }
 g.computeVertexNormals();return g;
}

function bodyGeometry(){
 const profile=[[-.49,.015,-.02],[-.40,.24,-.03],[-.24,.375,0],[0,.445,.035],[.22,.38,.10],[.40,.255,.23],[.54,.205,.34],[.65,.215,.43],[.76,.225,.47],[.87,.175,.47],[.94,.08,.46],[.96,.005,.45]];
 const curve=new THREE.CatmullRomCurve3(profile.map(([y,r,z])=>new THREE.Vector3(r,y,z)));
 const points=curve.getPoints(32),positions=[],colors=[],indices=[];
 const grey=new THREE.Color('#94a3ad'),ivory=new THREE.Color('#e5e0d3'),teal=new THREE.Color('#4c7774');
 for(let j=0;j<points.length;j++)for(let i=0;i<=32;i++){
   const q=points[j],a=i/32*Math.PI*2,x=Math.sin(a)*q.x,z=Math.cos(a)*q.x*.91+q.z;
   positions.push(x,q.y,z);
   const front=Math.max(0,Math.cos(a));
   const chest=front*front*Math.max(0,1-Math.abs(q.y+.02)/.5);
   const collar=Math.exp(-(((q.y-.47)/.13)**2));
   const c=grey.clone().lerp(ivory,chest*.95).lerp(teal,collar*.72);colors.push(c.r,c.g,c.b);
   if(j<points.length-1&&i<32){const k=j*33+i;indices.push(k,k+1,k+33,k+1,k+34,k+33);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createPigeon(){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 let realBird=null, flightSprite=null, flightDownSprite=null, realMeshes=[], modelBaseY=0;
 const torso=new THREE.Mesh(bodyGeometry(),material('#ffffff',{vertexColors:true}));body.add(torso);
 const head=new THREE.Group();head.position.set(0,.73,.47);body.add(head);
 const eyeMaterial=material('#0c1d30',{roughness:.12});
 for(const s of [-1,1]){
  sculpt(head,material('#8d9290'),[.199*s,.033,.084],[.033,.036,.032]);
  sculpt(head,eyeMaterial,[.221*s,.038,.087],[.021,.025,.021]);
  sculpt(head,material('#f7faf7',{emissive:'#ffffff',emissiveIntensity:.2}),[.235*s,.048,.092],[.006,.007,.006]);
 }
 sculpt(head,material('#e1ddd1'),[0,-.005,.207],[.048,.028,.045]);
 const beak=new THREE.Mesh(beakGeometry(),material('#72695f'));beak.position.set(0,-.046,.282);head.add(beak);
 const tail=new THREE.Group();tail.position.set(0,-.16,-.34);body.add(tail);
 plumage(tail,charcoal,Array.from({length:6},(_,i)=>({p:[(i-2.5)*.065,0,-.24],s:[.082,.04,.24],a:-(i-2.5)*.09})));
 plumage(tail,blue,Array.from({length:5},(_,i)=>({p:[(i-2)*.065,.025,-.12],s:[.085,.035,.17],a:-(i-2)*.08})));
 const leather=material('#926340',{roughness:.9});
 const satchel=new THREE.Group(); satchel.position.set(.45,-.15,.15); satchel.rotation.z=.14;
 const bag=new THREE.Mesh(beveledBox(.18,.30,.34,.045),leather);
 const flap=new THREE.Mesh(beveledBox(.21,.13,.36,.025),material('#af7c50'));
 flap.position.y=.12;
 const buckle=new THREE.Mesh(beveledBox(.035,.072,.085,.01),material('#d9b879',{metalness:.5,roughness:.4}));
 buckle.position.set(.125,.045,.04); satchel.add(bag,flap,buckle); body.add(satchel);
 const strapCurve=new THREE.CatmullRomCurve3([[.48,-.06,.19],[.37,.23,.31],[.10,.40,.39],[-.23,.32,.37],[-.37,.03,.22],[-.20,-.31,.12],[.24,-.36,.13],[.48,-.06,.19]].map(p=>new THREE.Vector3(...p)));
 const strap=new THREE.Mesh(new THREE.TubeGeometry(strapCurve,40,.023,6,false),leather);body.add(strap);
 const legs=new THREE.Group(),feet=material('#e69b78');
 for(const side of [-1,1]){
   sculpt(legs,feet,[side*.15,-.45,.10],[.037,.15,.04]);
   for(const angle of [-.5,0,.5]){
     const toe=sculpt(legs,feet,[side*.15+Math.sin(angle)*.075,-.615,.18],[.025,.025,.12]);
     toe.rotation.y=angle;
   }
 }
 body.add(legs);
 const left=wing(1),right=wing(-1);body.add(left.shoulder,right.shoulder,left.folded,right.folded);
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 let phase=0,time=0,amplitude=0;
 return {
  root,head,
  useModel(scene){
   const bounds=new THREE.Box3().setFromObject(scene),size=new THREE.Vector3(),center=new THREE.Vector3();
   bounds.getSize(size);bounds.getCenter(center);
   if(!Number.isFinite(size.y)||size.y<=0)return false;
   const scale=2.1/size.y;
   scene.scale.setScalar(scale);
   scene.position.set(-center.x*scale,-.64-bounds.min.y*scale,-center.z*scale);
   scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.color.setScalar(1.45);realMeshes.push(o);}});
   modelBaseY=scene.position.y;
   root.add(scene);realBird=scene;body.visible=false;
   return true;
  },
  useFlightSprite(sprite,downTexture){
   const down=new THREE.Sprite(sprite.material.clone());down.material.map=downTexture;
   down.scale.copy(sprite.scale);down.position.y=.27;
   root.add(sprite,down);flightSprite=sprite;flightDownSprite=down;
  },
  debugPose(){return {phase:+Math.sin(phase).toFixed(2),up:flightSprite?.visible,down:flightDownSprite?.visible};},
  makeShadow(mat){
   const copy=root.clone(true),src=[],dst=[];root.traverse(o=>src.push(o));copy.traverse(o=>{dst.push(o);if(o.isMesh){o.material=mat;o.castShadow=false;o.receiveShadow=false;}});
   return {root:copy,sync(){src.forEach((o,i)=>{dst[i].visible=o.visible;dst[i].position.copy(o.position);dst[i].quaternion.copy(o.quaternion);dst[i].scale.copy(o.scale);});}};
  },
  update(dt,state){
   time+=dt;
   const fold=state.fold,land=state.landing*(1-fold);
   if(realBird){
    realBird.visible=fold>.01||!flightSprite;
    for(const mesh of realMeshes){mesh.material.opacity=flightSprite?Math.max(.01,fold):1;mesh.material.transparent=true;mesh.material.depthWrite=fold>.5;}
    realBird.position.y=modelBaseY+Math.sin(time*2)*.006*fold;
   }
   const glide=state.flap<.9&&(time%3.8)>2.5;
   amplitude=lerp(amplitude,state.flap*(glide?.15:1),1-Math.exp(-dt*6));
   phase+=dt*(4.8+state.flap*1.8)*Math.PI*2*Math.max(.25,amplitude);
   if(flightSprite){
    const down=Math.sin(phase)<-.1;
    flightSprite.visible=fold<.99&&!down;
    flightDownSprite.visible=fold<.99&&down;
    flightSprite.material.opacity=1-fold;
    flightDownSprite.material.opacity=1-fold;
    flightSprite.material.rotation=Math.sin(time*9)*.035*(1-fold);
    flightDownSprite.material.rotation=flightSprite.material.rotation;
   }
   for(const w of [left,right]){
     const side=w.side;
     const stroke=Math.sin(phase)*.86*amplitude+.08;
     const wrist=Math.sin(phase-.7)*.46*amplitude+.025;
     w.shoulder.position.set(.32*side,.16,.05);
     w.inner.rotation.set(0,-Math.cos(phase)*.1*amplitude*side-land*.3*side,lerp(stroke,.9,land)*side);
     w.outer.rotation.set(0,0,lerp(wrist,-.3,land)*side);
     const spread=1-fold;
     w.shoulder.scale.setScalar(Math.max(.001,spread));w.shoulder.visible=spread>.001;
     w.folded.scale.setScalar(Math.max(.001,fold));w.folded.visible=fold>.001;

   }
   body.position.y=-Math.sin(phase)*.035*amplitude;
   body.rotation.x=.45*(1-fold);
   const feetOut=Math.max(state.legs,fold);
   legs.scale.y=lerp(.05,1,feetOut); legs.position.y=lerp(.25,0,feetOut);
   legs.position.z=lerp(-.2,0,feetOut);
   head.position.z=.47; head.rotation.x=0;
   body.rotation.y=lerp(body.rotation.y,(state.look||0)*.15,1-Math.exp(-dt*3));
   tail.rotation.x=-.12+land*.4+Math.sin(time*1.3)*.025*fold;
   torso.scale.y=1+Math.sin(time*2)*.006*fold;

  },
 };
}
