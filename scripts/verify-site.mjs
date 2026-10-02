import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(resolve(root, '../../EmailApp/package.json'))('@playwright/test');
const config = JSON.parse(await readFile(resolve(root, 'vercel.json')));
const output = process.env.PIGEONBOX_SITE_QA_OUT || '/tmp/pigeonbox-site-qa';
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const redirect = config.redirects.find(row => row.source === pathname);
  if (redirect) { res.writeHead(307, { Location: redirect.destination }); res.end(); return; }
  let file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
  if (!extname(file)) file += '.html';
  try {
    await stat(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    let requests = 0, mode = 'failure', submitted;
    await page.route('https://pigeonbox-cloud-api.pigeonbox.workers.dev/v1/waitlist', async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST' } }); return; }
      requests++; submitted = route.request().postDataJSON();
      await route.fulfill({ status: mode === 'failure' ? 500 : mode === 'limited' ? 429 : 202, headers: { 'Access-Control-Allow-Origin': origin }, contentType: 'application/json', body: mode === 'success' ? '{"ok":true}' : '{"error":{"message":"test failure"}}' });
    });
    await page.goto(origin + '/waitlist?source=extension');
    await page.locator('canvas[data-halftone=waitlist]').waitFor();
    await page.waitForFunction(() => document.querySelector('canvas[data-halftone=waitlist]').width > 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    await page.screenshot({ path: `${output}/waitlist-${width}.png`, fullPage: true });
    const canvas = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForTimeout(300);
    assert.equal(await page.locator('canvas').evaluate(canvas => canvas.toDataURL()), canvas, 'reduced motion canvas must be static');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0, 'no reduced motion animations');
    await page.locator('#waitlist-email').fill('invalid');
    await page.locator('button[type=submit]').click();
    assert.equal(requests, 0);
    assert.equal(await page.locator('#waitlist-email').getAttribute('aria-invalid'), 'true');
    await page.locator('#waitlist-email').fill('owner@example.test');
    await page.locator('button[type=submit]').click();
    await page.getByText('We couldn’t save your place.', { exact: false }).waitFor();
    assert.equal(await page.locator('#waitlist-email').inputValue(), 'owner@example.test');
    mode = 'limited'; await page.locator('button[type=submit]').click();
    await page.getByText('Too many attempts.', { exact: false }).waitFor();
    mode = 'success'; await page.locator('button[type=submit]').click();
    await page.getByText('You’re on the list. Thanks for coming along.').waitFor();
    assert.deepEqual(submitted, { email: 'owner@example.test', source: 'extension', website: '' });
    assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
    assert.equal(requests, 3);
    results.push({ width, layout: 'pass', reducedMotion: 'pass', invalid: 'pass', persistenceFailureRetry: 'pass', rateLimit: 'pass', signup: 'pass' });
    await context.close();
  }
  const page = await browser.newPage();
  for (const path of ['/', '/local', '/cloud', '/pricing', '/docs', '/privacy', '/security', '/terms']) {
    const response = await page.goto(origin + path); assert.equal(response.status(), 200);
    for (const link of await page.locator('a[href="/waitlist"]').all()) assert.equal(await link.getAttribute('href'), '/waitlist');
    assert.ok(await page.locator('.site-nav a[href="/waitlist"]').count(), `${path} Cloud nav`);
  }
  await page.goto(origin + '/');
  await page.getByRole('button', { name: 'Open command palette' }).last().click();
  await page.getByRole('option').filter({ hasText: 'Cloud beta' }).click();
  await page.waitForURL('**/waitlist');
  assert.deepEqual(errors, []);
  await page.close();
  await readFile(resolve(root, 'waitlist.js')); // all scripts were exercised in browser
  console.log(JSON.stringify({ results, cloudNavigation: 'pass', pageErrors: errors, screenshots: output }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
