import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const site=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const app=resolve(process.argv[2]||resolve(site,'../../PigeonBox'));
const cloud=resolve(process.argv[3]||resolve(site,'../../pigeonbox-cloud'));
const sharp=createRequire(resolve(app,'package.json'))('sharp');
const ext=resolve(app,'apps/extension');
const same=async(a,b)=>{
  const left=await sharp(a).ensureAlpha().raw().toBuffer(),right=await sharp(b).ensureAlpha().raw().toBuffer();
  assert.equal(left.length,right.length,`Asset dimensions differ: ${b}`);
  // Lossless WebP drops hidden RGB under alpha=0; compare every visible pixel and alpha.
  for(let i=0;i<left.length;i+=4)assert.ok(left[i+3]===right[i+3]&&(!left[i+3]||(left[i]===right[i]&&left[i+1]===right[i+1]&&left[i+2]===right[i+2])),`Stale asset copy: ${b}`);
};
await same(resolve(site,'brand/pidgy.webp'),resolve(ext,'brand-src/pigeon-states.png'));
for(const p of [resolve(site,'assets/gmail-demo/brand/pigeon-sprites.webp'),resolve(cloud,'apps/web/public/brand/pigeon-sprites.webp'),resolve(ext,'public/brand/pigeon-sprites.png'),resolve(app,'launch-video/public/brand/pigeon-sprites.png')])await same(resolve(ext,'public/brand/pigeon-sprites.webp'),p);
for(const size of [16,48,128]){
  const icon=resolve(ext,`public/icons/icon${size}.png`),m=await sharp(icon).metadata();assert.equal(m.width,size);assert.equal(m.height,size);assert.equal(m.hasAlpha,true);
  await same(icon,resolve(site,`assets/gmail-demo/icons/icon${size}.png`));
}
for(const p of [resolve(site,'brand/pigeon-icon.png'),resolve(cloud,'apps/web/public/brand/pigeon-icon.png'),resolve(cloud,'apps/web/public/control/pigeon-icon.png'),resolve(cloud,'apps/web/public/pigeon.png')])await same(resolve(ext,'public/icons/icon128.png'),p);
await same(resolve(site,'og.png'),resolve(cloud,'apps/web/public/og.png'));
const atlas=resolve(ext,'public/brand/pigeon-sprites.webp');
for(let row=0;row<5;row++)for(let col=0;col<4;col++){
  const pixels=await sharp(atlas).extract({left:col*320,top:row*256,width:320,height:256}).raw().toBuffer();
  let opaque=0,bottom=0;
  for(let y=0;y<256;y++)for(let x=0;x<320;x++)if(pixels[(y*320+x)*4+3]>128){opaque++;bottom=Math.max(bottom,y+1);assert.ok(x>0&&x<319&&y>0&&y<255,`Clipped ${row}/${col}`);}
  assert.ok(opaque>15000,`Empty frame ${row}/${col}`);assert.equal(bottom,252,`Foot baseline ${row}/${col}`);
}
console.log('Shared app/demo/Cloud/film sprites and icons match; all 20 frames have safe padding and aligned feet; share images match.');
