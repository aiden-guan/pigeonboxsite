// Builds the marketing walkthrough from the real extension components. No .env,
// production services, private mail or extension installation are involved.
import { readFile, writeFile, mkdir, cp, mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const source = dirname(fileURLToPath(import.meta.url));
const site = resolve(source, '../..');
const app = resolve(process.argv[2] || resolve(site, '../../PigeonBox'));
const requireApp = createRequire(resolve(app, 'package.json'));
const dep = (name) => pathToFileURL(requireApp.resolve(name)).href;
const { build } = await import(dep('vite'));
const { default: react } = await import(dep('@vitejs/plugin-react'));
const { default: tailwind } = await import(dep('tailwindcss'));
const { default: autoprefixer } = await import(dep('autoprefixer'));
const { default: tailwindConfig } = await import(pathToFileURL(resolve(app, 'apps/extension/tailwind.config.js')));
const staging = await realpath(await mkdtemp(resolve(tmpdir(), 'pb-gmail-demo-')));
const outDir = resolve(site, 'assets/gmail-demo');
const sourceFiles = new Set();
try {
  await cp(resolve(source, 'index.html'), resolve(staging, 'index.html'));
  await cp(resolve(source, 'sidepanel.html'), resolve(staging, 'sidepanel.html'));
  await cp(resolve(source, 'gmail.css'), resolve(staging, 'gmail.css'));
  await cp(resolve(source, 'motion.ts'), resolve(staging, 'motion.ts'));
  const main = (await readFile(resolve(source, 'main.tsx'), 'utf8')).replaceAll('@extension/', `${app}/apps/extension/src/`);
  await writeFile(resolve(staging, 'main.tsx'), main);
  await writeFile(resolve(staging, 'workspace.tsx'), (await readFile(resolve(source, 'workspace.tsx'), 'utf8')).replaceAll('@extension/', `${app}/apps/extension/src/`));
  const aliases = Object.fromEntries(['shared', 'api-contract', 'core', 'cloud-client', 'gmail', 'mailbox', 'ai', 'search', 'agent', 'tracking'].map(name => [`@pigeonbox/${name}`, resolve(app, `packages/${name}/src`)]));
  Object.assign(aliases, { react: resolve(app, 'node_modules/react'), 'react-dom': resolve(app, 'node_modules/react-dom') });
  await build({
    configFile: false, root: staging, envDir: staging, base: '/assets/gmail-demo/', publicDir: false,
    cacheDir: resolve(staging, '.vite'), plugins: [react(), {
      name: 'pigeonbox-source-snapshot',
      transform(_code, id) {
        const file = id.split('?')[0];
        if (file.startsWith(resolve(app, 'apps/extension/src') + '/') || file.startsWith(resolve(app, 'packages') + '/')) sourceFiles.add(file);
        return null;
      },
    }], resolve: { alias: aliases, dedupe: ['react', 'react-dom'] },
    define: { 'import.meta.env.VITE_PIGEONBOX_CLOUD_API_URL': '""', 'import.meta.env.VITE_PIGEONBOX_CLOUD_TRACKER_URL': '""', 'import.meta.env.VITE_PIGEONBOX_EXPERIMENTAL': '"false"', 'import.meta.env.VITE_PIGEONBOX_DEV_REBUILD_URL': '""' },
    css: { postcss: { plugins: [tailwind({ ...tailwindConfig, content: [resolve(app, 'apps/extension/src/**/*.{html,ts,tsx}'), resolve(staging, '*.tsx')] }), autoprefixer()] } },
    build: {
      outDir, emptyOutDir: true, sourcemap: false, target: 'es2020',
      rollupOptions: { input: { demo: resolve(staging, 'index.html'), workspace: resolve(staging, 'sidepanel.html') } },
    },
  });
  await cp(resolve(app, 'apps/extension/public/icons'), resolve(outDir, 'icons'), { recursive: true });
  await mkdir(resolve(outDir, 'brand'), { recursive: true });
  await cp(resolve(app, 'apps/extension/public/brand/pigeon-sprites.webp'), resolve(outDir, 'brand/pigeon-sprites.webp'));
  // Brand assets are part of the source snapshot, just like the rendered components.
  for (const file of ['brand/pigeon-sprites.webp', 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png']) {
    sourceFiles.add(resolve(app, 'apps/extension/public', file));
  }
  const snapshot = createHash('sha256');
  for (const file of [...sourceFiles].sort()) snapshot.update(relative(app, file)).update('\0').update(await readFile(file)).update('\0');
  const changes = execFileSync('git', ['-C', app, 'status', '--porcelain', '--', ...[...sourceFiles].map(file => relative(app, file))], { encoding: 'utf8' }).trim();
  await writeFile(resolve(outDir, 'provenance.json'), JSON.stringify({
    source: 'https://github.com/aiden-guan/pigeonbox',
    commit: execFileSync('git', ['-C', app, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingTree: changes ? 'modified' : 'clean',
    sourceSnapshotSha256: snapshot.digest('hex'),
    components: ['apps/extension/src/workspace/PigeonBoxWorkspace.tsx', 'apps/extension/src/workspace/CurrentThread.tsx', 'apps/extension/src/content/thread/ThreadPanel.tsx', 'apps/extension/src/ui/DispatchThreads.tsx'],
    mail: 'Fictional fixture. Gmail chrome is recreated; PigeonBox components and styles are built directly from the extension source.',
  }, null, 2) + '\n');
} finally { await rm(staging, { recursive: true, force: true }); }
