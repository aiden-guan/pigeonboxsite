import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { layoutFeatureOrbit } from '../pricing-orbit.js';

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
    await page.goto(origin + '/pricing');
    const cloudTrigger = page.locator('[data-cloud-trigger]');
    const cloudList = page.locator('.cloud-orbit-list');
    await page.locator('.pricing-stage.is-ready').waitFor();
    assert.equal(await cloudTrigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await cloudList.isVisible(), false);
    const cards = await page.locator('.pricing-stage').evaluate(stage => ({
      local: stage.querySelector('.local-plan').getBoundingClientRect().height,
      cloud: stage.querySelector('.cloud-plan').getBoundingClientRect().height,
    }));
    assert.ok(Math.abs(cards.local - cards.cloud) < 1, `plan heights match at ${width}`);
    assert.equal(await page.locator('.local-features li').count(), 5);
    await page.locator('.cloud-orbit-list[data-feature-icons-ready="true"]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.feature-icon[data-icon-name]').count(), 18);
    assert.equal(await page.locator('[data-orbit-pause]').count(), 0);
    assert.equal(await page.locator('[data-cloud-close]').count(), 0);
    await page.screenshot({ path: `${output}/pricing-comparison-${width}.png`, fullPage: true });
    await cloudTrigger.scrollIntoViewIfNeeded();
    await cloudTrigger.press('Enter');
    assert.equal(await cloudTrigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await cloudList.isVisible(), true);
    await page.waitForFunction(() => {
      const card = document.querySelector('.cloud-plan').getBoundingClientRect();
      const header = document.querySelector('.site-header').getBoundingClientRect();
      return card.top >= header.bottom && card.bottom <= innerHeight;
    });
    assert.equal(await page.locator('#cloud-cta').evaluate(node => {
      const box = node.getBoundingClientRect();
      const card = node.closest('.cloud-plan').getBoundingClientRect();
      return box.bottom <= card.bottom && box.right <= card.right;
    }), true, `Cloud CTA stays inside the card at ${width}`);
    await page.waitForFunction(() => document.querySelector('[data-cloud-art]').dataset.cloudPainted === 'true');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.orbit-feature').count(), 18);
    assert.equal(await cloudList.innerText().then(text => /Testing|Tracked documents|Sequences/.test(text)), false);
    const geometry = await page.locator('.cloud-art').evaluate(world => {
      const bounds = world.getBoundingClientRect();
      const labels = [...world.querySelectorAll('.orbit-feature')].map(node => node.getBoundingClientRect());
      return {
        clipped: labels.some(box => box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1),
        overlaps: labels.flatMap((a, i) => labels.slice(i + 1).filter(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)).length,
      };
    });
    await page.screenshot({ path: `${output}/pricing-orbit-${width}.png` });
    assert.equal(geometry.clipped, false, `orbit labels clipped at ${width}`);
    assert.equal(geometry.overlaps, 0, `orbit labels overlap at ${width}`);
    assert.equal(await page.evaluate(width => document.documentElement.scrollWidth <= width, width), true, `pricing overflow at ${width}`);
    const art = await page.locator('[data-cloud-art]').evaluate(canvas => canvas.toDataURL());
    const positions = await page.locator('.orbit-feature').evaluateAll(nodes => nodes.map(node => node.style.transform));
    await page.waitForTimeout(150);
    assert.ok(await page.locator('[data-cloud-art]').evaluate(canvas => canvas.toDataURL()) === art, 'reduced motion cloud must be static');
    assert.deepEqual(await page.locator('.orbit-feature').evaluateAll(nodes => nodes.map(node => node.style.transform)), positions, 'reduced motion orbit must be static');
    assert.equal(await page.evaluate(() => document.querySelector('.pricing-stage').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
    await cloudTrigger.press('Escape');
    assert.equal(await cloudList.isVisible(), false);
    assert.equal(await cloudTrigger.evaluate(node => node === document.activeElement), true, 'closing restores trigger focus');
    await cloudTrigger.click();
    assert.equal(await cloudTrigger.getAttribute('aria-expanded'), 'true');
    await cloudTrigger.press('Escape');
    assert.equal(await cloudList.isVisible(), false);
    results.push({ width, layout: 'pass', reducedMotion: 'pass', invalid: 'pass', persistenceFailureRetry: 'pass', rateLimit: 'pass', signup: 'pass', dispatchViewport: 'pass', expandedDemo: 'pass', inboxCategories: 'pass', workspacePause: 'pass', pricingOrbit: 'pass' });
    await context.close();
  }
  // Exercise touch opening/closing with motion, including short screens and rotation.
  for (const [width, height] of [[320, 480], [320, 600], [390, 844], [430, 932], [768, 1024], [844, 390], [667, 375], [568, 320]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const touchPage = await context.newPage();
    observe(touchPage);
    await touchPage.goto(origin + '/pricing');
    const trigger = touchPage.locator('[data-cloud-trigger]');
    await trigger.tap();
    await touchPage.waitForFunction(() => !document.querySelector('.cloud-orbit-list').inert);
    await touchPage.waitForTimeout(850);
    const geometry = await touchPage.locator('.cloud-art').evaluate(world => {
      const bounds = world.getBoundingClientRect();
      const card = world.closest('.cloud-plan').getBoundingClientRect();
      const offer = document.querySelector('.cloud-offer').getBoundingClientRect();
      const cta = document.querySelector('#cloud-cta').getBoundingClientRect();
      const labels = [...world.querySelectorAll('.orbit-feature')].map(node => node.getBoundingClientRect());
      return {
        clipped: labels.some(box => box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1),
        overlaps: labels.some((a, i) => labels.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2)),
        offerClear: bounds.bottom <= offer.top + 1,
        ctaInside: cta.bottom <= card.bottom && cta.right <= card.right,
        cappedDpr: world.querySelector('canvas').width <= bounds.width * 2 + 1,
      };
    });
    assert.deepEqual(geometry, { clipped: false, overlaps: false, offerClear: true, ctaInside: true, cappedDpr: true }, `touch geometry at ${width}×${height}`);
    assert.equal(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await touchPage.locator('[data-icon-active]').count(), 0, 'touch does not leave sticky icon hover animations');
    await touchPage.screenshot({ path: `${output}/pricing-touch-${width}x${height}.png` });
    if (width === 390) {
      for (const viewport of [{ width: 844, height: 390 }, { width, height }]) {
        await touchPage.setViewportSize(viewport);
        await touchPage.waitForFunction(() => {
          const card = document.querySelector('.cloud-plan').getBoundingClientRect();
          const header = document.querySelector('.site-header').getBoundingClientRect();
          return card.top >= header.bottom && card.top < header.bottom + 24;
        });
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true', 'rotation keeps Cloud open and framed');
      }
    }
    await trigger.tap();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'touch closes Cloud without an intercepted tap');
    const closed = await touchPage.locator('.pricing-stage').evaluate(stage => [...stage.querySelectorAll('.local-plan, .cloud-plan')].map(node => node.getBoundingClientRect().height));
    assert.equal(closed[0], closed[1], 'touch close restores matching plan heights');
    if (width === 430) {
      await trigger.tap();
      await touchPage.waitForFunction(() => !document.querySelector('.cloud-orbit-list').inert);
      await touchPage.locator('#cloud-cta').tap();
      await touchPage.waitForURL(origin + '/waitlist');
    }
    await context.close();
  }
  // Sample a complete five-minute revolution at 60 Hz using actual rendered
  // label dimensions. This caught intermittent jumps missed by a still screenshot.
  for (const [width, height] of [[1440, 800], [1024, 800], [834, 838], [768, 1000], [390, 844], [320, 600], [844, 390], [667, 375], [568, 320]]) {
    const orbitPage = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    observe(orbitPage);
    await orbitPage.goto(origin + '/pricing');
    await orbitPage.locator('[data-cloud-trigger]').press('Enter');
    await orbitPage.evaluate(() => document.fonts.ready);
    const geometry = await orbitPage.locator('.cloud-art').evaluate(world => ({
      width: world.clientWidth, height: world.clientHeight,
      sizes: [...world.querySelectorAll('.orbit-feature')].map(node => ({ w: node.offsetWidth, h: node.offsetHeight })),
    }));
    let previous, peakMovement = 0;
    for (let frame = 0; frame <= 18000; frame++) {
      const positions = layoutFeatureOrbit(geometry.width, geometry.height, geometry.sizes, frame / 60);
      positions.forEach((a, i) => {
        assert.ok(Number.isFinite(a.x + a.y), `orbit coordinates valid at ${width}`);
        assert.ok(a.x >= a.w / 2 - 1 && a.x <= geometry.width - a.w / 2 + 1 && a.y >= a.h / 2 - 1 && a.y <= geometry.height - a.h / 2 + 1, `orbit stays inside at ${width}, ${frame}`);
        if (previous) peakMovement = Math.max(peakMovement, Math.hypot(a.x - previous[i].x, a.y - previous[i].y));
        for (const b of positions.slice(i + 1)) {
          assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 2, `orbit labels stay separate at ${width}, ${frame}`);
        }
      });
      previous = positions;
    }
    // This is a deterministic geometry bound, independent of runner frame cadence.
    assert.ok(peakMovement < 1, `orbit has no sudden position jumps at ${width}: ${peakMovement}`);
    await orbitPage.close();
  }
  const page = await browser.newPage();
  observe(page);
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(origin + '/pricing');
  await page.locator('.pricing-stage.is-ready').waitFor();
  const animatedTrigger = page.locator('[data-cloud-trigger]');
  await animatedTrigger.scrollIntoViewIfNeeded();
  // Observe the cloud's actual painted anchor through the layout change.
  await page.evaluate(() => {
    window.cloudTravelFrames = [];
    const ellipse = CanvasRenderingContext2D.prototype.ellipse;
    CanvasRenderingContext2D.prototype.ellipse = function (x, y, rx, ry, rotation, ...rest) {
      if (this.canvas.matches('[data-cloud-art]') && rotation === -.24 && Math.abs(rx / ry - .54 / .19) < .001) {
        const box = this.canvas.getBoundingClientRect();
        const list = document.querySelector('.cloud-orbit-list');
        window.cloudTravelFrames.push({
          x: box.left + x, y: box.top + scrollY + y - (rx / .54) * .03, scale: rx / .54,
          targetX: box.left + box.width / 2, targetY: box.top + scrollY + box.height / 2,
          open: document.querySelector('[data-cloud-trigger]').getAttribute('aria-expanded') === 'true',
          opacity: list.hidden ? 0 : Math.max(...[...list.children].map(node => Number(getComputedStyle(node).opacity))),
        });
      }
      return ellipse.call(this, x, y, rx, ry, rotation, ...rest);
    };
  });
  await page.locator('[data-cloud-art]').hover();
  await page.waitForFunction(() => document.querySelector('[data-cloud-trigger]').getAttribute('aria-expanded') === 'true');
  const expandedBounds = await page.locator('.cloud-plan').boundingBox();
  await page.mouse.move(expandedBounds.x + 20, expandedBounds.y + 20);
  await page.waitForFunction(() => document.querySelector('.cloud-plan').getAnimations().every(a => a.playState !== 'running'));
  await page.waitForTimeout(250);
  const travelFrames = await page.evaluate(() => window.cloudTravelFrames);
  const firstOpen = travelFrames.findIndex(frame => frame.open);
  assert.ok(firstOpen > 0, 'cloud has a painted starting location');
  const originalCloud = travelFrames[firstOpen - 1], expandingCloud = travelFrames[firstOpen];
  assert.ok(Math.hypot(originalCloud.x - expandingCloud.x, originalCloud.y - expandingCloud.y) < 1, 'cloud retains its original location on expansion');
  assert.ok(Math.abs(originalCloud.scale - expandingCloud.scale) < 1, 'cloud retains its original scale on expansion');
  assert.ok(travelFrames.some(frame => frame.open && frame.opacity === 0 && Math.hypot(frame.x - frame.targetX, frame.y - frame.targetY) > 20), 'features stay hidden while the cloud travels');
  const revealedFrames = travelFrames.filter(frame => frame.open && frame.opacity > 0);
  assert.ok(revealedFrames.length > 0, 'features reveal after the cloud arrives');
  assert.ok(revealedFrames.every(frame => Math.hypot(frame.x - frame.targetX, frame.y - frame.targetY) < 1), 'features appear only around the centered cloud');
  const startPositions = await page.locator('.orbit-feature').evaluateAll(nodes => nodes.map(node => node.style.transform));
  await page.waitForTimeout(250);
  assert.notDeepEqual(await page.locator('.orbit-feature').evaluateAll(nodes => nodes.map(node => node.style.transform)), startPositions, 'features orbit the cloud');
  await page.locator('.cloud-orbit-list[data-feature-icons-ready="true"]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('[data-orbit-pause]').count(), 0);
  const iconPose = node => [...node.querySelectorAll('[data-icon-part]')].map(part => {
    const style = getComputedStyle(part);
    return [style.transform, style.opacity, style.clipPath];
  });
  for (const feature of await page.locator('.orbit-feature').all()) {
    const name = await feature.locator('.feature-icon').getAttribute('data-icon-name');
    const resting = await feature.evaluate(iconPose);
    await feature.hover({ force: true });
    await page.waitForTimeout(650);
    const heldPositions = await page.locator('.orbit-feature').evaluateAll(nodes => nodes.map(node => node.style.transform));
    const first = await feature.evaluate(iconPose);
    await page.waitForTimeout(400);
    assert.notDeepEqual(first, resting, `${name} icon tells its story on hover`);
    assert.notDeepEqual(await feature.evaluate(iconPose), first, `${name} icon animation progresses`);
    assert.deepEqual(await page.locator('.orbit-feature').evaluateAll(nodes => nodes.map(node => node.style.transform)), heldPositions, 'hover holds the orbit steady');
    assert.equal(await page.locator('.orbit-feature:not([data-icon-active]) [data-icon-part]').evaluateAll(parts => parts.some(part => part.getAnimations().some(animation => animation.playState === 'running'))), false, 'other icons remain still');
    if (name === 'tracking') await page.screenshot({ path: `${output}/pricing-icon-hover.png` });
    await page.mouse.move(expandedBounds.x + 20, expandedBounds.y + 20);
    await page.waitForTimeout(260);
    assert.deepEqual(await feature.evaluate(iconPose), resting, `${name} returns cleanly to its static drawing`);
  }
  await page.screenshot({ path: `${output}/pricing-orbit-desktop.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.orbit-feature').first().hover();
  await page.waitForTimeout(260);
  assert.equal(await page.locator('[data-icon-part]').evaluateAll(parts => parts.some(part => part.getAnimations().some(animation => animation.playState === 'running'))), false, 'reduced motion suppresses hover icon animation');
  await page.mouse.move(expandedBounds.x + 20, expandedBounds.y + 20);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(10, 10);
  await page.waitForFunction(() => document.querySelector('[data-cloud-trigger]').getAttribute('aria-expanded') === 'false');
  assert.equal(await page.locator('.cloud-orbit-list').isVisible(), false, 'leaving Cloud restores the comparison');
  const restored = await page.locator('.pricing-stage').evaluate(stage => ({
    local: stage.querySelector('.local-plan').getBoundingClientRect().height,
    cloud: stage.querySelector('.cloud-plan').getBoundingClientRect().height,
  }));
  assert.equal(restored.local, restored.cloud);
  await animatedTrigger.press('Enter');
  await animatedTrigger.press('Escape');
  await animatedTrigger.press('Enter');
  assert.equal(await animatedTrigger.getAttribute('aria-expanded'), 'true', 'rapid reversal settles open');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
  const fallback = await noJs.newPage();
  await fallback.goto(origin + '/pricing');
  assert.equal(await fallback.locator('.cloud-orbit-list').isVisible(), true, 'features stay readable without JavaScript');
  assert.equal(await fallback.locator('.orbit-feature').count(), 18);
  assert.equal(await fallback.evaluate(() => document.documentElement.scrollWidth <= 390), true);
  await noJs.close();
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
