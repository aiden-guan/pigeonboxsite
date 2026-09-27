// PigeonBox Cloud account site. Talks to the same-origin API with the public
// contract. Tokens are kept in sessionStorage for this tab only.
const PROTOCOL = { 'x-pigeonbox-protocol': '1', 'x-pigeonbox-client': 'web/0.1.0' };
const SESSION_KEY = 'pigeonbox.session';
const PENDING_KEY = 'pigeonbox.pending';

const $ = (selector) => document.querySelector(selector);

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomToken(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}
async function challengeFor(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}
function writeSession(session) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

const redirectUri = () => `${location.origin}/auth/callback`;

export async function startSignIn() {
  const status = $('#notice') || $('#sign-in-status');
  if (status) status.textContent = 'Starting sign-in…';
  try {
    const verifier = randomToken(48);
    const state = randomToken(24);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
    const query = new URLSearchParams({ redirect_uri: redirectUri(), code_challenge: await challengeFor(verifier), code_challenge_method: 'S256', state });
    location.assign(`/v1/auth/authorize?${query}`);
  } catch {
    if (status) status.textContent = 'Sign-in could not start. Reload the page and try again.';
  }
}

async function api(path, { method = 'GET', body } = {}, retried = false) {
  const session = readSession();
  const headers = { ...PROTOCOL, Accept: 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit' });
  if (response.status === 401 && session && !retried) {
    const refreshed = await fetch('/v1/auth/refresh', {
      method: 'POST',
      headers: { ...PROTOCOL, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (refreshed.ok) {
      writeSession(await refreshed.json());
      return api(path, { method, body }, true);
    }
    writeSession(null);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Request failed (${response.status})`);
  return data;
}

export async function completeSignIn() {
  const params = new URLSearchParams(location.search);
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
  sessionStorage.removeItem(PENDING_KEY);
  const status = $('#status');
  if (!pending || params.get('state') !== pending.state || !params.get('code')) {
    status.textContent = 'Sign-in could not be verified. Start again.';
    return;
  }
  try {
    const session = await api('/v1/auth/token', { method: 'POST', body: { code: params.get('code'), codeVerifier: pending.verifier, redirectUri: redirectUri() } });
    writeSession(session);
    location.replace('/account');
  } catch (error) {
    status.textContent = error.message;
  }
}

const STATUS_TEXT = {
  none: 'No subscription',
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  unpaid: 'Unpaid',
  paused: 'Paused',
};

function text(selector, value) {
  $(selector).textContent = value;
}

function initSiteNavigation() {
  const toggle = $('.menu-toggle');
  const nav = $('#site-nav');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav?.classList.toggle('is-open', open);
  });
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.setAttribute('aria-label', 'Open menu');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.focus();
    }
  });
  if (readSession()) {
    document.querySelectorAll('.account-link').forEach((link) => {
      link.hidden = false;
      link.textContent = 'Account';
      link.href = '/account';
    });
  } else {
    void fetch('/v1/health', { headers: PROTOCOL }).then((response) => {
      if (!response.ok) return;
      document.querySelectorAll('.account-link').forEach((link) => {
        link.hidden = false;
        link.textContent = 'Sign in';
        link.href = '/account';
      });
    }).catch(() => undefined);
  }
}

async function initInstallLinks() {
  try {
    const response = await fetch('/site-config.json');
    if (!response.ok) return;
    const { installUrl, installLabel } = await response.json();
    if (!installUrl || !/^https:\/\//.test(installUrl)) return;
    document.querySelectorAll('[data-install]').forEach((link) => {
      link.href = installUrl;
      if (installLabel && link.closest('.hero-copy')) link.firstChild.textContent = installLabel + ' ';
    });
  } catch {
    // The static links already point to the public installation instructions.
  }
}

async function renderPublicPrice() {
  const output = $('#cloud-price');
  if (!output) return;
  try {
    const response = await fetch('/v1/public/pricing', { headers: PROTOCOL });
    if (!response.ok) return;
    const price = await response.json();
    if (!price.available || !Number.isInteger(price.unitAmount) || !price.currency || !price.interval) return;
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency.toUpperCase(), maximumFractionDigits: price.unitAmount % 100 === 0 ? 0 : 2 }).format(price.unitAmount / 100);
    output.innerHTML = '';
    output.append(document.createTextNode(formatted + ' '));
    const period = document.createElement('small');
    period.textContent = '/ ' + price.interval;
    output.append(period);
    $('#cloud-price-detail').textContent = 'Hosted inference and tracking, billed through Stripe. Cancel from your account.';
    $('#cloud-cta').href = '/account';
    $('#cloud-cta').textContent = 'Start Cloud ↗';
  } catch {
    // Missing billing configuration is an early-access state, not a page error.
  }
}

function initProductDemo() {
  const frame = $('[data-demo]');
  const toggle = $('[data-demo-toggle]');
  if (!frame || !toggle) return;
  const stages = [
    { title: 'Friday’s review', body: 'Maya likes the direction. She needs two small changes before Friday: the opening line and one screenshot.', label: 'Draft a reply' },
    { title: 'The thread, caught up.', body: 'PigeonBox pulls the latest change and action from the opened thread, so you can decide what to do next.', label: 'Start the draft' },
    { title: 'A reply to review.', body: 'Thanks for the clear notes. I’ll soften the opening line and update the screenshot before Friday.', label: 'Review in Gmail' },
    { title: 'Ready in Gmail.', body: 'The draft is placed in Gmail’s composer. You check it, edit it, and press Send when it’s right.', label: 'Replay' },
  ];
  let step = 0;
  let timer = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const render = () => {
    frame.querySelector('.companion h3').textContent = stages[step].title;
    frame.querySelector('.companion-inner > p:not(.companion-kicker)').textContent = stages[step].body;
    frame.querySelector('[data-demo-next]').firstChild.textContent = stages[step].label + ' ';
    frame.dataset.step = String(step);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    toggle.setAttribute('aria-pressed', 'false');
    toggle.innerHTML = step === stages.length - 1 ? 'Replay walkthrough <span aria-hidden="true">↺</span>' : 'Play walkthrough <span aria-hidden="true">▶</span>';
  };
  const advance = () => {
    step = (step + 1) % stages.length;
    render();
    if (step === stages.length - 1) stop();
  };
  toggle.addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (step === stages.length - 1) { step = 0; render(); }
    if (reduced.matches) { advance(); return; }
    toggle.setAttribute('aria-pressed', 'true');
    toggle.innerHTML = 'Pause walkthrough <span aria-hidden="true">Ⅱ</span>';
    advance();
    if (step !== stages.length - 1) timer = setInterval(advance, 2200);
  });
  $('[data-demo-next]')?.addEventListener('click', advance);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop(); }, { threshold: 0.15 }).observe(frame);
}

export async function renderAccount() {
  const session = readSession();
  if (!session) {
    $('#signed-out').hidden = false;
    $('#sign-in').addEventListener('click', startSignIn);
    return;
  }
  $('#signed-in').hidden = false;
  const notice = $('#notice');
  const checkout = new URLSearchParams(location.search).get('checkout');
  if (checkout === 'success') notice.textContent = 'Thanks. Your subscription will show here as soon as Stripe confirms it.';
  try {
    const [me, entitlements, pricing] = await Promise.all([api('/v1/me'), api('/v1/account/entitlements'), api('/v1/public/pricing').catch(() => ({ available: false }))]);
    text('#email', me.user.email || me.user.id);
    text('#plan', me.plan === 'cloud' ? 'PigeonBox Cloud' : 'Free (Local only)');
    text('#subscription', STATUS_TEXT[me.subscription.status] || me.subscription.status);
    text('#renews', me.subscription.currentPeriodEnd ? new Date(me.subscription.currentPeriodEnd).toLocaleDateString() : '—');
    const requests = entitlements.usage.aiRequestsToday;
    text('#usage', `${requests} ${requests === 1 ? 'request' : 'requests'} today · ${entitlements.usage.aiTokensThisMonth.toLocaleString()} tokens this month`);
    const chips = $('#capabilities');
    chips.replaceChildren(
      ...(entitlements.capabilities.length ? entitlements.capabilities : ['none']).map((name) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = name.replace(/_/g, ' ');
        return chip;
      }),
    );
    $('#subscribe').hidden = me.plan === 'cloud' || !pricing.available;
    if (!pricing.available && me.plan !== 'cloud') $('#billing-state').textContent = 'Cloud subscriptions are not configured yet.';
    $('#portal').hidden = me.subscription.status === 'none';
  } catch (error) {
    notice.textContent = error.message;
    if (!readSession()) {
      $('#signed-in').hidden = true;
      $('#signed-out').hidden = false;
      $('#sign-in').addEventListener('click', startSignIn);
      document.querySelectorAll('.account-link').forEach((link) => { link.textContent = 'Sign in'; });
      return;
    }
  }

  const go = (path) => async (event) => {
    event.target.disabled = true;
    try {
      const { url } = await api(path, { method: 'POST', body: {} });
      location.assign(url);
    } catch (error) {
      notice.textContent = error.message;
      event.target.disabled = false;
    }
  };
  $('#subscribe').addEventListener('click', go('/v1/billing/checkout'));
  $('#portal').addEventListener('click', go('/v1/billing/portal'));
  $('#sign-out').addEventListener('click', async () => {
    await api('/v1/auth/signout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined);
    writeSession(null);
    location.replace('/');
  });
  $('#delete').addEventListener('click', async () => {
    const typed = prompt('This deletes your PigeonBox Cloud account, hosted tracking data and usage records, and cancels your subscription. Local PigeonBox data in your browser is not affected.\n\nType "delete my account" to confirm.');
    if (typed !== 'delete my account') return;
    try {
      await api('/v1/account/delete', { method: 'POST', body: { confirm: typed } });
      writeSession(null);
      location.replace('/?deleted=1');
    } catch (error) {
      notice.textContent = error.message;
    }
  });
}

const page = document.body.dataset.page;
initSiteNavigation();
void initInstallLinks();
if (page === 'home') initProductDemo();
if (page === 'pricing') void renderPublicPrice();
if (page === 'sign-in') {
  if (readSession()) location.replace('/account');
  else $('#sign-in')?.addEventListener('click', startSignIn);
}
if (page === 'callback') void completeSignIn();
if (page === 'account') void renderAccount();
