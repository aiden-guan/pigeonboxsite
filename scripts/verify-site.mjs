import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(resolve(root, '../../PigeonBox/package.json'))('@playwright/test');
const config = JSON.parse(await readFile(resolve(root, 'vercel.json')));
const output = process.env.PIGEONBOX_SITE_QA_OUT || '/tmp/pigeonbox-site-qa';
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const pathname = requestUrl.pathname;
  const redirect = config.redirects.find(row => row.source === pathname);
  if (redirect) { res.writeHead(307, { Location: redirect.destination + requestUrl.search }); res.end(); return; }
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
const cspErrors = [];
const results = [];
function observe(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy') && !cspErrors.includes(message.text())) cspErrors.push(message.text());
  });
}
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width <= 768, hasTouch: width <= 768, reducedMotion: 'reduce' });
    const page = await context.newPage();
    observe(page);
    let requests = 0, mode = 'failure', submitted;
    await page.route('https://pigeonbox-cloud-api.pigeonbox.workers.dev/v1/waitlist', async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST' } }); return; }
      requests++; submitted = route.request().postDataJSON();
      await route.fulfill({ status: mode === 'failure' ? 500 : mode === 'limited' ? 429 : 202, headers: { 'Access-Control-Allow-Origin': origin }, contentType: 'application/json', body: mode === 'success' ? '{"ok":true}' : '{"error":{"message":"test failure"}}' });
    });
    await page.goto(origin + '/waitlist?source=extension');
    await page.locator('canvas.wl-dots').waitFor();
    await page.waitForFunction(() => document.querySelector('canvas.wl-dots').width > 1);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    assert.ok(await page.locator('#waitlist-email').evaluate(input => parseFloat(getComputedStyle(input).fontSize) >= 16), 'email must not trigger mobile focus zoom');
    if (width <= 900) {
      const gap = await page.evaluate(() => {
        const title = document.querySelector('.wl-title').getBoundingClientRect();
        const props = [...document.querySelectorAll('.wl-prop')].filter(button => button.getAttribute('aria-label') !== 'Catch the plane');
        return title.top - Math.max(...props.map(button => button.getBoundingClientRect().bottom));
      });
      assert.ok(gap >= 20, `waitlist artwork overlaps text at ${width}`);
    }
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
    await page.goto(origin + '/');
    for (let stop = 1; stop <= 5; stop++) {
      await page.locator(`#stop-${stop}`).click();
      assert.equal(await page.locator(`#stop-${stop}`).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator(`#stage-${stop}`).isVisible(), true, `dispatch stop ${stop} must show its panel`);
      // Compare with the requested width: mobile engines can widen innerWidth to fit overflow.
      assert.equal(await page.evaluate(width => document.documentElement.scrollWidth <= width, width), true, `dispatch overflow at ${width}, stop ${stop}`);
    }
    await page.locator('[data-demo-expand]').click();
    assert.equal(await page.locator('[data-demo-dialog]').evaluate(dialog => {
      const bounds = dialog.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight;
    }), true, `expanded demo clipped at ${width}`);
    await page.locator('[data-demo-expand]').click();
    assert.equal(await page.locator('[data-demo-dialog]').evaluate(dialog => dialog.open), false, 'expanded demo must close by tapping its control');
    // The source-built Gmail walkthrough replaced the old homepage inbox lab.
    // Exercise the actual workspace category control inside its two frames.
    const demo = page.frameLocator('[data-gmail-demo] iframe');
    const workspace = demo.frameLocator('.gm-workspace-frame');
    const categorySelect = workspace.getByRole('combobox', { name: 'Inbox category' });
    await categorySelect.waitFor();
    assert.equal(await categorySelect.evaluate(() => getComputedStyle(document.getElementById('root')).animationPlayState), 'paused', 'reduced motion must pause the embedded workspace under the production CSP');
    for (const category of ['RESPOND', 'WAITING', 'FYI', 'FOLLOW_UPS']) {
      await categorySelect.selectOption(category);
      assert.equal(await categorySelect.inputValue(), category);
    }
    results.push({ width, layout: 'pass', reducedMotion: 'pass', invalid: 'pass', persistenceFailureRetry: 'pass', rateLimit: 'pass', signup: 'pass', dispatchViewport: 'pass', expandedDemo: 'pass', inboxCategories: 'pass', workspacePause: 'pass' });
    await context.close();
  }
  const page = await browser.newPage();
  observe(page);
  for (const path of ['/', '/local', '/cloud', '/pricing', '/docs', '/privacy', '/security', '/terms']) {
    const response = await page.goto(origin + path); assert.equal(response.status(), 200);
    for (const link of await page.locator('a[href="/waitlist"]').all()) assert.equal(await link.getAttribute('href'), '/waitlist');
    assert.ok(await page.locator('.site-nav a[href="/waitlist"]').count(), `${path} Cloud nav`);
  }
  for (const path of ['/dashboard', '/account', '/sign-in', '/app']) {
    await page.goto(origin + path);
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/dashboard');
    assert.equal(await page.locator('body').getAttribute('data-auth'), 'out');
  }
  await page.goto(origin + '/auth/callback?code=release-invalid-code&state=release-invalid-state');
  await page.getByText('Sign-in could not be verified. Start again.', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, '', 'invalid callback credentials must be removed from the URL');
  await page.goto(origin + '/dashboard?error=access_denied&error_code=signup_disabled&error_description=PRIVATE_PROVIDER_CANARY');
  await page.getByText('An invitation is needed', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, '');
  assert.equal((await page.locator('#view').innerText()).includes('PRIVATE_PROVIDER_CANARY'), false);
  assert.equal(await page.getByRole('link', { name: 'Join the waitlist', exact: true }).getAttribute('href'), 'https://usepigeonbox.com/waitlist');
  await page.goto(origin + '/');
  const autoplay = page.frameLocator('[data-gmail-demo] iframe');
  for (const stage of ['inbox', 'brief', 'summary', 'drafting', 'compose', 'ask', 'answer', 'source']) {
    await autoplay.locator(`.gm-demo[data-stage="${stage}"]`).waitFor();
  }
  await page.locator('[data-demo-pause]').click();
  await autoplay.locator('html.is-paused').waitFor();
  const pausedTime = await autoplay.locator('.gm-recording').getAttribute('data-time');
  await page.waitForTimeout(300);
  assert.equal(await autoplay.locator('.gm-recording').getAttribute('data-time'), pausedTime, 'Pause must stop the walkthrough clock');
  await page.locator('[data-demo-pause]').click();
  await page.waitForTimeout(300);
  assert.notEqual(await autoplay.locator('.gm-recording').getAttribute('data-time'), pausedTime, 'Play must resume the walkthrough clock');
  await page.getByRole('button', { name: 'Open command palette' }).last().click();
  await page.getByRole('option').filter({ hasText: 'Cloud beta' }).click();
  await page.waitForURL('**/waitlist');
  assert.deepEqual(errors, []);
  assert.deepEqual(cspErrors, [], 'pages and their embedded walkthrough must obey the production CSP');
  await page.close();
  await readFile(resolve(root, 'waitlist.js')); // all scripts were exercised in browser
  console.log(JSON.stringify({ results, cloudNavigation: 'pass', walkthroughAutoplay: 'pass', pageErrors: errors, cspErrors, screenshots: output }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
