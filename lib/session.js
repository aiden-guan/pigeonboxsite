// Session and API access for the PigeonBox Cloud web app (/dashboard). Talks to
// the same-origin API, or to the API named by <meta name="pigeonbox-api"> when
// the website hosts the dashboard. Tokens live in sessionStorage for this tab.
// The sign-in completes at /dashboard itself.

export const PROTOCOL = { 'x-pigeonbox-protocol': '1', 'x-pigeonbox-client': 'web/0.2.0' };
const SESSION_KEY = 'pigeonbox.session';
const PENDING_KEY = 'pigeonbox.pending';
const RETURN_KEY = 'pigeonbox.return';

/** API origin: empty for same-origin, otherwise an https (or loopback) origin from the page. */
export const API_BASE = (() => {
  const value = globalThis.document?.querySelector('meta[name="pigeonbox-api"]')?.getAttribute('content')?.trim() ?? '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(url.hostname) ? url.origin : '';
  } catch {
    return '';
  }
})();
const apiUrl = (path) => `${API_BASE}${path}`;

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

async function challengeFor(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the session lasts until the page closes.
  }
}

const redirectUri = () => `${location.origin}/dashboard`;

/** Start PKCE sign-in, coming back to `returnTo` (a hash within /dashboard, e.g. "#approvals"). */
export async function startSignIn(status, returnTo = '') {
  if (status) status.textContent = 'Starting sign-in…';
  try {
    const verifier = randomToken(48);
    const state = randomToken(24);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
    if (/^#[a-z]{0,20}$/.test(returnTo)) sessionStorage.setItem(RETURN_KEY, returnTo);
    const query = new URLSearchParams({ redirect_uri: redirectUri(), code_challenge: await challengeFor(verifier), code_challenge_method: 'S256', state });
    location.assign(apiUrl(`/v1/auth/authorize?${query}`));
  } catch {
    if (status) status.textContent = 'Sign-in could not start. Reload the page and try again.';
  }
}

/** An API error with the contract's error code. */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 30_000;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const userShape = (value) => record(value) && typeof value.id === 'string' && (value.email === null || typeof value.email === 'string');

/** The static client cannot import the TS/Zod contract; validate its bootstrap/session fields before using them. */
function validResponse(path, data) {
  if (!record(data)) return false;
  const route = path.split('?')[0];
  if (route === '/v1/me') return userShape(data.user) && typeof data.plan === 'string' && record(data.subscription)
    && typeof data.subscription.status === 'string' && (data.subscription.currentPeriodEnd === null || typeof data.subscription.currentPeriodEnd === 'string')
    && typeof data.subscription.cancelAtPeriodEnd === 'boolean';
  if (route === '/v1/capabilities') return typeof data.plan === 'string' && Array.isArray(data.capabilities) && data.capabilities.every((value) => typeof value === 'string');
  if (route === '/v1/auth/token' || route === '/v1/auth/refresh') return typeof data.accessToken === 'string' && data.accessToken.length >= 16
    && typeof data.refreshToken === 'string' && data.refreshToken.length >= 8 && Number.isInteger(data.expiresAt) && data.expiresAt > 0 && userShape(data.user);
  return true;
}

/** Bound both the network request and response body; temporary failures never clear a session. */
async function request(path, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl(path), { ...init, signal: controller.signal });
    const data = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error;
      return null;
    });
    if (response.ok && !validResponse(path, data)) throw new ApiError('PigeonBox Cloud returned an invalid response. Try again.', 'unavailable', response.status);
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('PigeonBox Cloud took too long to respond. Try again.', 'unavailable', 0);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

let refreshInFlight = null;
/** Refresh once for concurrent callers. Temporary failures preserve the session. */
async function refreshSession(session) {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { response, data } = await request('/v1/auth/refresh', {
        method: 'POST',
        headers: { ...PROTOCOL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        credentials: 'omit',
      });
      if (response.ok) {
        // A sign-out during refresh must not resurrect the session.
        if (readSession()?.refreshToken === session.refreshToken) writeSession(data);
        return;
      }
      if (response.status === 400 || response.status === 401) {
        if (readSession()?.refreshToken === session.refreshToken) writeSession(null);
      }
      throw new ApiError(data?.error?.message || 'Session refresh failed. Try again.', data?.error?.code || 'unavailable', response.status);
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function api(path, { method = 'GET', body } = {}, retried = false) {
  const session = readSession();
  const headers = { ...PROTOCOL, Accept: 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const { response, data } = await request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit' });
  if (response.status === 401 && session && !retried) {
    // Another request may have completed refresh while this response was in flight.
    if (readSession()?.refreshToken === session.refreshToken) await refreshSession(session);
    return api(path, { method, body }, true);
  }
  if (response.status === 401 && session && retried) writeSession(null);
  if (!response.ok) throw new ApiError(data?.error?.message || `Request failed (${response.status})`, data?.error?.code || 'error', response.status);
  return data;
}

/**
 * Finish sign-in when the identity provider sent the browser back to /dashboard
 * with `code` and `state`. Returns the hash to open, or null if this page
 * load was not a sign-in return. Throws with a readable message on failure.
 */
export async function finishSignIn(params) {
  if (!params.has('code') && !params.has('state')) return null;
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
  sessionStorage.removeItem(PENDING_KEY);
  if (!pending || params.get('state') !== pending.state || !params.get('code')) throw new Error('Sign-in could not be verified. Start again.');
  const session = await api('/v1/auth/token', { method: 'POST', body: { code: params.get('code'), codeVerifier: pending.verifier, redirectUri: redirectUri() } });
  writeSession(session);
  const back = sessionStorage.getItem(RETURN_KEY) || '#overview';
  sessionStorage.removeItem(RETURN_KEY);
  return back;
}

export async function signOut() {
  const session = readSession();
  if (session) await api('/v1/auth/signout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined);
  writeSession(null);
}

/** Upload a file body (PUT) with the session token. */
export async function upload(path, file, retried = false) {
  const session = readSession();
  const headers = { ...PROTOCOL, Accept: 'application/json', 'Content-Type': file.type || 'application/octet-stream' };
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  const { response, data } = await request(path, { method: 'PUT', headers, body: file, credentials: 'omit' });
  if (response.status === 401 && session && !retried) {
    if (readSession()?.refreshToken === session.refreshToken) await refreshSession(session);
    return upload(path, file, true);
  }
  if (response.status === 401 && session && retried) writeSession(null);
  if (!response.ok) throw new ApiError(data?.error?.message || `Upload failed (${response.status})`, data?.error?.code || 'error', response.status);
  return data;
}
