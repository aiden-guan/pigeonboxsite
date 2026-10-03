// Propagate the approved Pidgy art. This changes local assets only.
// node scripts/pidgy/sync-brand.mjs [public-app-root] [cloud-root]
import { createRequire } from 'node:module';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const site = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const app = resolve(process.argv[2] || resolve(site, '../../PigeonBox'));
const cloud = resolve(process.argv[3] || resolve(site, '../../pigeonbox-cloud'));
const sharp = createRequire(resolve(app, 'package.json'))('sharp');
const ext = resolve(app, 'apps/extension');
const put = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const canonical = resolve(site, 'brand/pidgy.webp');
const source = await sharp(canonical).png().toBuffer();
await put(resolve(ext, 'brand-src/pigeon-states.png'), source);
// Resting endpoints of the flight cycle use the exact same idle model as the app.
const flightPath=resolve(site,'brand/pidgy-flight.webp');
const {data:flightPixels,info:flightInfo}=await sharp(flightPath).raw().toBuffer({resolveWithObject:true});
const resting=await sharp(source).extract({left:0,top:0,width:96,height:96}).resize(112,112,{kernel:'nearest'}).raw().toBuffer();
for(const frame of [0,11])for(let y=0;y<112;y++)resting.copy(flightPixels,(y*1344+frame*112)*4,y*112*4,(y+1)*112*4);
await sharp(flightPixels,{raw:flightInfo}).webp({lossless:true}).toFile(flightPath);

// Keep the app's existing 320x256 contract; uniformly scale each pigeon, never its anatomy.
const cells = [];
for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
  const { data, info } = await sharp(source).extract({ left: col*96, top: row*96, width: 96, height: 96 }).raw().toBuffer({ resolveWithObject: true });
  let left=96, top=96, right=0, bottom=0;
  for(let y=0;y<96;y++) for(let x=0;x<96;x++) if(data[(y*96+x)*4+3]>24) {
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  }
  const scale=200/56, width=Math.round((right-left)*scale), height=Math.round((bottom-top)*scale);
  const x=Math.max(4,Math.min(316-width,Math.round(160-(44-left)*scale)));
  if(width>312||height>248) throw Error(`Clipped frame ${row}/${col}`);
  cells.push({ input: await sharp(data,{raw:info}).extract({left,top,width:right-left,height:bottom-top}).resize(width,height,{kernel:'nearest'}).png().toBuffer(), left:col*320+x,top:row*256+252-height });
}
const atlas=await sharp({create:{width:1280,height:1280,channels:4,background:'#00000000'}}).composite(cells).png().toBuffer();
const webp=await sharp(atlas).webp({lossless:true}).toBuffer();
await put(resolve(ext,'public/brand/pigeon-sprites.png'),atlas);
await put(resolve(ext,'public/brand/pigeon-sprites.webp'),webp);
await put(resolve(site,'assets/gmail-demo/brand/pigeon-sprites.webp'),webp);
await put(resolve(cloud,'apps/web/public/brand/pigeon-sprites.webp'),webp);
await put(resolve(app,'launch-video/public/brand/pigeon-sprites.png'),atlas);
const filmSheet=await sharp(atlas).resize(200,200,{kernel:'nearest'}).png().toBuffer();
await put(resolve(app,'launch-video/public/art/pigeon-sheet-1x.png'),filmSheet);
const {data:friendSource}=await sharp(filmSheet).extract({left:0,top:0,width:200,height:40}).raw().toBuffer({resolveWithObject:true});
const friends=Buffer.alloc(200*160*4);
for(const [variant,[brightness,blue,warm]] of [[1,0,0],[.82,.02,0],[1.12,-.02,0],[.95,0,.05]].entries()) {
  const pixels=Buffer.from(friendSource);
  for(let i=0;i<pixels.length;i+=4) {
    let r=pixels[i],g=pixels[i+1],b=pixels[i+2];const alpha=pixels[i+3],lum=r*.3+g*.59+b*.11;
    if(alpha&&r-b>22&&r<185&&lum>40){r=lum*1.02*1.25;g=lum*1.03*1.25;b=lum*1.12*1.25;}
    if(alpha&&!(r>190&&r-b>50)){r=r*brightness+18*warm;g=g*brightness+8*warm;b=b*brightness+30*blue;}
    pixels[i]=Math.min(255,Math.max(0,r));pixels[i+1]=Math.min(255,Math.max(0,g));pixels[i+2]=Math.min(255,Math.max(0,b));
  }
  pixels.copy(friends,variant*200*40*4);
}
await sharp(friends,{raw:{width:200,height:160,channels:4}}).png().toFile(resolve(app,'launch-video/public/art/pigeon-friends-1x.png'));

const {data:idle,info:idleInfo}=await sharp(source).extract({left:0,top:0,width:96,height:96}).raw().toBuffer({resolveWithObject:true});
let iconLeft=96,iconTop=96,iconRight=0,iconBottom=0;
for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(idle[(y*96+x)*4+3]>24){iconLeft=Math.min(iconLeft,x);iconTop=Math.min(iconTop,y);iconRight=Math.max(iconRight,x+1);iconBottom=Math.max(iconBottom,y+1);}
const bird=await sharp(idle,{raw:idleInfo}).extract({left:iconLeft,top:iconTop,width:iconRight-iconLeft,height:iconBottom-iconTop}).png().toBuffer();
for(const size of [16,48,128]) {
  const side=Math.round(size*.88);
  const {data:small,info}=await sharp(bird).resize(side,side,{fit:'inside',kernel:size===16?'lanczos3':'nearest'}).png().toBuffer({resolveWithObject:true});
  const icon=await sharp({create:{width:size,height:size,channels:4,background:'#00000000'}}).composite([{input:small,left:Math.floor((size-info.width)/2),top:Math.floor((size-info.height)/2)}]).png().toBuffer();
  await put(resolve(ext,`public/icons/icon${size}.png`),icon);
  await put(resolve(site,`assets/gmail-demo/icons/icon${size}.png`),icon);
  if(size===128)for(const path of [resolve(site,'brand/pigeon-icon.png'),resolve(cloud,'apps/web/public/brand/pigeon-icon.png'),resolve(cloud,'apps/web/public/control/pigeon-icon.png'),resolve(cloud,'apps/web/public/pigeon.png'),resolve(app,'docs/store/store-icon-128.png')])await put(path,icon);
}

// Tone-map the same sprite geometry for the site's red/green ink-density renderer.
const {data:ink,info:inkInfo}=await sharp(resolve(site,'brand/pidgy-world.webp')).raw().toBuffer({resolveWithObject:true});
for(let i=0;i<ink.length;i+=4) {
  const r=ink[i],g=ink[i+1],b=ink[i+2],alpha=ink[i+3];
  const copper=r>g*1.2&&r>b*1.35;
  const density=Math.round(90+(255-(r*.2126+g*.7152+b*.0722))*.65);
  ink[i]=copper?0:density;ink[i+1]=copper?density:0;ink[i+2]=0;ink[i+3]=alpha;
}
await sharp(ink,{raw:inkInfo}).png().toFile(resolve(site,'brand/pidgy-ink.png'));

// Adapt the approved 12-frame flight strip to the Cloud grid and the film's five-frame cycle.
const flight=resolve(site,'brand/pidgy-flight.webp');
const grid=[],film=[];
for(let i=0;i<12;i++)grid.push({input:await sharp(flight).extract({left:i*112,top:0,width:112,height:112}).png().toBuffer(),left:(i%4)*112,top:Math.floor(i/4)*112});
await sharp({create:{width:448,height:336,channels:4,background:'#00000000'}}).composite(grid).png().toFile(resolve(cloud,'apps/web/public/brand/pigeon-flight-atlas.png'));
for(const [i,frame] of [3,4,5,6,8].entries())film.push({input:await sharp(flight).extract({left:frame*112,top:0,width:112,height:112}).resize(50,50,{kernel:'nearest'}).png().toBuffer(),left:i*56+3,top:0});
await sharp({create:{width:280,height:50,channels:4,background:'#00000000'}}).composite(film).png().toFile(resolve(app,'launch-video/public/art/pigeon-fly-1x.png'));
await copyFile(flight,resolve(app,'launch-video/public/brand/pidgy-flight.webp'));
console.log('Updated site, app, demo, Cloud and film brand assets from approved Pidgy sheets.');
