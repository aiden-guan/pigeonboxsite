#!/usr/bin/env node
// Copy the PigeonBox Cloud dashboard from the private pigeonbox-cloud checkout
// into this site, served at /dashboard. The copy calls the Cloud API named in
// site-config.json ("cloudApiUrl") cross-origin; the API allows this origin.
//
//   node scripts/sync-dashboard.mjs [path/to/pigeonbox-cloud]
//   node scripts/sync-dashboard.mjs --check   (fails if the copy is stale)
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const cloud = resolve(args.find((arg) => !arg.startsWith('--')) ?? join(site, '../../pigeonbox-cloud'));
const source = join(cloud, 'apps/web/public');

const { cloudApiUrl } = JSON.parse(await readFile(join(site, 'site-config.json'), 'utf8'));
if (!/^https:\/\/[^/]+$/.test(cloudApiUrl ?? '')) throw new Error('site-config.json needs "cloudApiUrl" as an https origin without a path.');

/** Published path → content. Directories are copied whole. */
async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else if (!entry.name.startsWith('.')) out.push(path);
  }
  return out;
}

const wanted = new Map();
for (const dir of ['control', 'lib']) {
  for (const path of await files(join(source, dir))) wanted.set(relative(source, path), await readFile(path));
}
const html = await readFile(join(source, 'dashboard.html'), 'utf8');
const marker = '<meta name="pigeonbox-api" content="" />';
if (!html.includes(marker)) throw new Error(`dashboard.html has no empty ${marker}`);
wanted.set('dashboard.html', Buffer.from(html.replace(marker, `<meta name="pigeonbox-api" content="${cloudApiUrl}" />`)));

if (check) {
  const stale = [];
  for (const [path, content] of wanted) {
    const current = await readFile(join(site, path)).catch(() => null);
    if (!current || !current.equals(content)) stale.push(path);
  }
  for (const dir of ['control', 'lib']) {
    for (const path of await files(join(site, dir)).catch(() => [])) if (!wanted.has(relative(site, path))) stale.push(relative(site, path));
  }
  if (stale.length) {
    console.error(`Dashboard copy is stale: ${stale.join(', ')}. Run node scripts/sync-dashboard.mjs`);
    process.exit(1);
  }
  console.log(`Dashboard copy matches ${source}`);
} else {
  for (const dir of ['control', 'lib']) await rm(join(site, dir), { recursive: true, force: true });
  for (const [path, content] of wanted) {
    await mkdir(dirname(join(site, path)), { recursive: true });
    await writeFile(join(site, path), content);
  }
  console.log(`Copied ${wanted.size} dashboard files from ${source} (API ${cloudApiUrl})`);
}
