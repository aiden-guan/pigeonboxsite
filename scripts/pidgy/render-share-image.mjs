import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const site=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const app=resolve(site,'../../PigeonBox');
const require=createRequire(resolve(app,'package.json'));
const sharp=require('sharp');
const screenshot=resolve(app,'docs/store/screenshot-1.png');
const icon=resolve(site,'brand/pigeon-icon.png');
const crop=await sharp(screenshot)
  .extract({left:90,top:262,width:1100,height:528})
  .png()
  .toBuffer();
const [iconPng]=await Promise.all([readFile(icon)]);
const uiData=`data:image/png;base64,${crop.toString('base64')}`;
const iconData=`data:image/png;base64,${iconPng.toString('base64')}`;

const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r="1.2" fill="#6d6f6d"/></pattern>
  <radialGradient id="fade"><stop offset="34%" stop-color="white"/><stop offset="74%" stop-color="black"/></radialGradient>
  <mask id="dotMask"><rect width="1200" height="630" fill="black"/><ellipse cx="1090" cy="55" rx="222" ry="168" fill="url(#fade)"/></mask>
  <clipPath id="productClip"><rect x="453" y="175" width="696" height="334" rx="17"/></clipPath>
  <filter id="shadow" x="-15%" y="-22%" width="130%" height="154%"><feDropShadow dx="0" dy="13" stdDeviation="17" flood-color="#2b261e" flood-opacity=".13"/></filter>
</defs>
<rect width="1200" height="630" fill="#f3f0e8"/>
<rect x="920" y="-90" width="350" height="330" fill="url(#dots)" opacity=".46" mask="url(#dotMask)"/>
<path d="M530 170 C648 116 811 116 960 164" fill="none" stroke="#b75a38" stroke-width="4" stroke-linecap="round" stroke-dasharray=".1 13"/>
<image href="${iconData}" x="64" y="44" width="36" height="36" preserveAspectRatio="xMidYMid meet"/>
<text x="112" y="73" fill="#1d1d1f" font-family="Georgia, Times New Roman, serif" font-size="28" letter-spacing="-.7">PigeonBox</text>
<path d="M257 45v36" stroke="#c8c2b7" stroke-width="1"/>
<text x="277" y="68" fill="#b04f2e" font-family="Courier New, monospace" font-size="12" letter-spacing="2">01</text>
<text x="309" y="68" fill="#59616a" font-family="Courier New, monospace" font-size="12" letter-spacing="3">GMAIL INTELLIGENCE</text>
<path d="M64 105H1136" stroke="#d6d0c5" stroke-width="1"/>
<text x="64" y="233" fill="#1d1d1f" font-family="Georgia, Times New Roman, serif" font-size="66" letter-spacing="-2.8">Know what</text>
<text x="64" y="303" fill="#536071" font-family="Georgia, Times New Roman, serif" font-size="66" letter-spacing="-2.8">needs you.</text>
<text x="68" y="376" fill="#58616a" font-family="Arial, Helvetica, sans-serif" font-size="20">Respond, Waiting, and FYI—</text>
<text x="68" y="406" fill="#58616a" font-family="Arial, Helvetica, sans-serif" font-size="20">sorted beside Gmail.</text>
<text x="68" y="446" fill="#202124" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">Works with AI off.</text>
<g filter="url(#shadow)"><rect x="453" y="175" width="696" height="334" rx="17" fill="#fff"/></g>
<image href="${uiData}" x="454" y="176" width="694" height="332" preserveAspectRatio="xMidYMid slice" clip-path="url(#productClip)"/>
<rect x="453.5" y="175.5" width="695" height="333" rx="17" fill="none" stroke="#77736d" stroke-opacity=".26"/>
<image href="${iconData}" x="1083" y="128" width="66" height="66" preserveAspectRatio="xMidYMid meet"/>
<text x="68" y="565" fill="#b04f2e" font-family="Courier New, monospace" font-size="12" letter-spacing="2">01</text>
<text x="97" y="565" fill="#59616a" font-family="Courier New, monospace" font-size="12" letter-spacing="2">LOCAL BY DEFAULT · FREE · OPEN SOURCE</text>
<text x="1138" y="565" text-anchor="end" fill="#68727a" font-family="Arial, Helvetica, sans-serif" font-size="12">PigeonBox in Gmail · Fictional example mail</text>
</svg>`;

await writeFile(resolve(site,'scripts/pidgy/share-image.svg'),svg);
await sharp(Buffer.from(svg)).png().toFile(resolve(site,'og.png'));
const posterSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs>
  <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.35" fill="#6d6f6d"/></pattern>
  <radialGradient id="fade"><stop offset="34%" stop-color="white"/><stop offset="76%" stop-color="black"/></radialGradient>
  <mask id="dotMask"><rect width="1600" height="900" fill="black"/><ellipse cx="1460" cy="66" rx="240" ry="196" fill="url(#fade)"/></mask>
  <clipPath id="productClip"><rect x="625" y="248" width="900" height="432" rx="21"/></clipPath>
  <filter id="shadow" x="-15%" y="-22%" width="130%" height="154%"><feDropShadow dx="0" dy="16" stdDeviation="21" flood-color="#2b261e" flood-opacity=".14"/></filter>
</defs>
<rect width="1600" height="900" fill="#f3f0e8"/>
<rect x="1300" y="-110" width="360" height="360" fill="url(#dots)" opacity=".46" mask="url(#dotMask)"/>
<path d="M730 239 C930 144 1224 145 1473 228" fill="none" stroke="#b75a38" stroke-width="5" stroke-linecap="round" stroke-dasharray=".1 15"/>
<image href="${iconData}" x="78" y="69" width="46" height="46" preserveAspectRatio="xMidYMid meet"/>
<text x="138" y="107" fill="#1d1d1f" font-family="Georgia, Times New Roman, serif" font-size="36" letter-spacing="-.8">PigeonBox</text>
<path d="M356 69v48" stroke="#c8c2b7" stroke-width="1.5"/>
<text x="392" y="99" fill="#b04f2e" font-family="Courier New, monospace" font-size="14" letter-spacing="2.4">01</text>
<text x="429" y="99" fill="#59616a" font-family="Courier New, monospace" font-size="14" letter-spacing="3.2">GMAIL INTELLIGENCE</text>
<path d="M78 148H1522" stroke="#d6d0c5" stroke-width="1.5"/>
<text x="78" y="363" fill="#1d1d1f" font-family="Georgia, Times New Roman, serif" font-size="93" letter-spacing="-3.8">Know what</text>
<text x="78" y="461" fill="#536071" font-family="Georgia, Times New Roman, serif" font-size="93" letter-spacing="-3.8">needs you.</text>
<text x="84" y="562" fill="#58616a" font-family="Arial, Helvetica, sans-serif" font-size="25">Respond, Waiting, and FYI—</text>
<text x="84" y="598" fill="#58616a" font-family="Arial, Helvetica, sans-serif" font-size="25">sorted beside Gmail.</text>
<text x="84" y="644" fill="#202124" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="600">Works with AI off.</text>
<g filter="url(#shadow)"><rect x="625" y="248" width="900" height="432" rx="21" fill="#fff"/></g>
<image href="${uiData}" x="626" y="249" width="898" height="430" preserveAspectRatio="xMidYMid slice" clip-path="url(#productClip)"/>
<rect x="625.5" y="248.5" width="899" height="431" rx="21" fill="none" stroke="#77736d" stroke-opacity=".26"/>
<image href="${iconData}" x="1442" y="197" width="82" height="82" preserveAspectRatio="xMidYMid meet"/>
<text x="84" y="823" fill="#b04f2e" font-family="Courier New, monospace" font-size="14" letter-spacing="2.4">01</text>
<text x="119" y="823" fill="#59616a" font-family="Courier New, monospace" font-size="14" letter-spacing="2.2">LOCAL BY DEFAULT · FREE · OPEN SOURCE</text>
<text x="1522" y="823" text-anchor="end" fill="#68727a" font-family="Arial, Helvetica, sans-serif" font-size="14">PigeonBox in Gmail · Fictional example mail</text>
</svg>`;
await writeFile(resolve(site,'scripts/pidgy/launch-film-poster.svg'),posterSvg);
await sharp(Buffer.from(posterSvg)).jpeg({quality:92,mozjpeg:true}).toFile(resolve(site,'scripts/pidgy/launch-film-poster.jpg'));
console.log('Rendered og.png at 1200×630 from the current Chrome Web Store screenshot.');
