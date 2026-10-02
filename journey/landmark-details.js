import * as THREE from '../vendor/three.min.js';
import { LAND, heightAt } from './layout.js';
import { block, rod, windowFrame, planter, parcel, bench, bicycle, batchStatic, palette } from './craft.js';
import { stylizedMat } from './materials.js';

export function addLandmarkDetails(stop, landmark) {
  const group=new THREE.Group();
  const ground=heightAt(stop.x,stop.z);
  const roofMat=stylizedMat('#b9694d'), stone=stylizedMat('#cbb99b');
  if(stop.id==='rooftop'){
    const eave=LAND+7.5;
    const tiles=['#b9694d','#ba7053','#ae624b'].map(color=>stylizedMat(color));
    // Layered ceramic tiles, deliberately staggered with a small overlap.
    for(const side of [-1,1])for(let row=0;row<6;row++)for(let col=0;col<15;col++){
      const x=(.32+row*.64)*side,z=-5.05+col*.72+(row%2)*.08;
      const tile=block(group,[.80,.10,.69],[x,eave+3.4-Math.abs(x)*3.4/3.95+.16,z],tiles[(col+row*2)%3],.035);
      tile.rotation.z=-side*Math.atan(3.4/3.95);
    }
    for(const side of [-1,1]){
      rod(group,[side*4,eave,-5.5],[side*4,eave,5.5],.11);
      rod(group,[side*3.62,eave,-4.9],[side*3.62,LAND+.3,-4.9],.075);
      block(group,[.22,.27,10.8],[side*3.63,eave-.14,0]);
    }
    for(let i=0;i<15;i++){
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.75,12),roofMat);
      cap.rotation.x=Math.PI/2;cap.position.set(0,eave+3.34,-5.05+i*.72);group.add(cap);
    }
    // A dormer and inset casement on the visible roof slope.
    block(group,[1.65,1.45,1.6],[2.35,eave+1.15,1.1]);
    windowFrame(group,3.20,eave+.5,1.1,1.0,1.25,Math.PI/2);
    const dormerCap=block(group,[2.05,.16,1.95],[2.35,eave+1.95,1.1],roofMat);dormerCap.rotation.z=-.12;
    block(group,[1.35,.18,1.35],[2,LAND+11.9,-3.2],stone);
    block(group,[.72,.12,.72],[2,LAND+11.76,-3.2],palette.ink);
    rod(group,[-2,eave+1.9,-3],[-2,eave+4.8,-3],.035,palette.ink);
    rod(group,[-2.8,eave+4.3,-3],[-1.2,eave+4.3,-3],.028,palette.ink);
    // Roof terrace gives every pot a constructed support.
    block(group,[4,5.7,5],[-6.1,LAND+2.85,7.5],stone);
    block(group,[4.25,.22,5.25],[-6.1,LAND+5.81,7.5]);
    for(let i=0;i<4;i++)planter(group,-7.3+(i%2)*2.4,LAND+5.92,6+Math.floor(i/2)*2.8,.85);
    bench(group,-6.1,LAND+5.92,7.5,Math.PI/2);
    parcel(group,-5.2,LAND+5.92,6.2,.8);
    // A small level ridge perch keeps both feet in contact with the roof.
    block(group,[1.2,.10,1],[0,landmark.perchY-.05,4.3],palette.wood,.04);
  }
  if(stop.id==='clock'){
    for(const side of [-1,1]){
      for(const x of [-2.6,2.6])block(group,[.38,21.3,.28],[x,ground+12.7,side*3.67],stone);
      windowFrame(group,0,ground+3,side*3.76,1.45,3.5,side<0?Math.PI:0);
      for(const x of [-3.8,3.8])rod(group,[x,ground+23,side*4.15],[x,ground+24.2,side*4.15],.06);
      rod(group,[-4.1,ground+24.2,side*4.15],[4.1,ground+24.2,side*4.15],.07);
    }
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      for(const side of [-1,1]){
        const tick=block(group,[.10,.35,.07],[Math.sin(a)*2.12,ground+27.2+Math.cos(a)*2.12,side*4.45],palette.ink,.01);
        tick.rotation.z=-a;
      }
    }
    bicycle(group,-6.4,ground,6.5,.4);bench(group,7,ground,7,-.45);
    for(const x of [-7,7])planter(group,x,ground,-7,1.4);
    parcel(group,-5.8,ground,5.3,1.2);
  }
  if(stop.id==='windmill'){
    windowFrame(group,0,ground+5.7,-3.12,.9,1.45,Math.PI);
    windowFrame(group,0,ground+9.7,-2.72,.9,1.45,Math.PI);
    windowFrame(group,0,ground+.5,-3.52,1.25,2.1,Math.PI);
    windowFrame(group,0,ground+5.7,3.12,.9,1.45);
    windowFrame(group,0,ground+9.7,2.72,.9,1.45);
    for(let i=0;i<13;i++){
      const a=i*.25+.15,x=Math.cos(a)*10,z=Math.sin(a)*10;
      const y=heightAt(stop.x+x,stop.z+z);
      block(group,[.18,1.35,.18],[x,y+.675,z],palette.wood);
      if(i<12){const b=(i+1)*.25+.15;rod(group,[x,y+.95,z],[Math.cos(b)*10,heightAt(stop.x+Math.cos(b)*10,stop.z+Math.sin(b)*10)+.95,Math.sin(b)*10],.06,palette.wood);}
    }
    planter(group,3.8,ground,3.8,1.2);parcel(group,-3.5,ground,3.7,1.3);
    bicycle(group,-4.5,ground,4.7,.7);
  }
  if(stop.id==='lighthouse'){
    const top=ground-.2+16.8;
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;
      rod(group,[Math.cos(a)*2.3,top+.4,Math.sin(a)*2.3],[Math.cos(a)*2.3,top+1.1,Math.sin(a)*2.3],.045,palette.ink);
    }
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      rod(group,[Math.cos(a)*1.18,top+.4,Math.sin(a)*1.18],[Math.cos(a)*1.18,top+2.4,Math.sin(a)*1.18],.045,palette.ink);
    }
    windowFrame(group,0,ground+.2,2.33,.95,2.0);
    windowFrame(group,0,ground+7,1.99,.6,1.2);
    windowFrame(group,5.5,ground+.45,6.57,1,1.7);
    planter(group,8.3,ground,6.5,.9);parcel(group,3.5,ground,6.7,1);
    for(let i=0;i<6;i++)block(group,[2,.12,.7],[0,ground+.08-i*.08,3+i*.75],stone);
  }
  if(stop.id==='pyramid'){
    for(let i=0;i<8;i++){
      const x=20+(i%3)*1.2,z=-8+Math.floor(i/3)*1.3;
      parcel(group,x,heightAt(stop.x+x,stop.z+z),z,.8+(i%2)*.2);
    }
    // Canvas survey shelter with a timber frame and folded maps.
    const y=heightAt(stop.x+23,stop.z+3);
    for(const x of [20,26])for(const z of [1,6])rod(group,[x,y,z],[x,y+3.5,z],.08,palette.wood);
    const cloth=block(group,[6.6,.10,5.7],[23,y+3.5,3.5],palette.cream);cloth.rotation.z=.07;
    block(group,[2,.10,1.1],[23,y+1.4,3.5],palette.wood);
    block(group,[.9,.025,.7],[23,y+1.48,3.5],palette.tape,.01);
  }
  if(stop.id==='summit'){
    const x=-4,z=3,y=heightAt(stop.x-4,stop.z+3);
    rod(group,[x,y,z],[x,y+2.8,z],.10,palette.wood);
    block(group,[2.3,.55,.14],[x,y+2.5,z],palette.copper);
    parcel(group,3.7,heightAt(stop.x+3.7,stop.z+2),2,.8);
    for(let i=0;i<4;i++)planter(group,-6-i*.8,heightAt(stop.x-6-i*.8,stop.z-3),-3,.35);
  }
  if(stop.id==='home'){
    for(const [x,z,angle] of [[-8,8,.6],[8,8,-.6],[-8,-8,2.5],[8,-8,-2.5]]){
      bench(group,x,ground,z,angle);planter(group,x*1.3,ground,z*1.3,1.3);
    }
    bicycle(group,5.5,ground,4,.6);parcel(group,-4.4,ground+.6,1.4,1.3);parcel(group,-4.3,ground+.6,2.6,.9);
    // Door seam, rivets and an envelope relief on the existing oversized box.
    for(const x of [-2.3,2.3])block(group,[.08,5.4,.06],[x,ground+4.9,2.18],palette.copper,.015);
    for(const x of [-1,1])for(const y of [3.85,4.55]){
      const rivet=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),palette.copper);rivet.position.set(x,ground+y,2.28);group.add(rivet);
    }
    block(group,[1.25,.8,.08],[0,ground+4.25,2.34],palette.cream,.025);
    rod(group,[-.6,ground+4.6,2.40],[0,ground+4.17,2.40],.025,palette.copper);
    rod(group,[0,ground+4.17,2.40],[.6,ground+4.6,2.40],.025,palette.copper);
  }
  batchStatic(group);
  group.name=`${stop.id}-crafted-details`;
  landmark.group.add(group);
}
