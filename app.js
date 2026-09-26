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
  const verifier = randomToken(48);
  const state = randomToken(24);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const query = new URLSearchParams({ redirect_uri: redirectUri(), code_challenge: await challengeFor(verifier), code_challenge_method: 'S256', state });
  location.assign(`/v1/auth/authorize?${query}`);
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
    const [me, entitlements] = await Promise.all([api('/v1/me'), api('/v1/account/entitlements')]);
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
    $('#subscribe').hidden = me.plan === 'cloud';
    $('#portal').hidden = me.subscription.status === 'none';
  } catch (error) {
    notice.textContent = error.message;
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

export async function renderStatus() {
  try {
    const [health, version] = await Promise.all([api('/v1/health'), api('/v1/version')]);
    text('#api-status', health.ok ? 'Operational' : 'Degraded');
    text('#api-version', `${version.version} · protocol ${version.protocol.supported.join(', ')}`);
  } catch {
    text('#api-status', 'Unreachable');
  }
}

const page = document.body.dataset.page;
if (page === 'home') {
  void renderStatus();
  document.querySelector('#sign-in')?.addEventListener('click', startSignIn);
}
if (page === 'callback') void completeSignIn();
if (page === 'account') void renderAccount();
