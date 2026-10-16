// Cookieless page analytics for usepigeonbox.com and the dashboard. Sends a
// pageview, install clicks and dashboard sign-ins to PigeonBox Cloud's
// /v1/events/web, which forwards them to PostHog. No cookies, no localStorage,
// no visitor ID in the browser: Cloud derives a hash of the day, IP and user
// agent that changes every UTC day. Only the page path, a referrer category and
// known campaign values are sent (docs/product-analytics.md). Honors Global
// Privacy Control and Do Not Track.
//
// The one thing kept is the campaign name (for example `sent_with`, the Free
// email footer) in sessionStorage for this tab, so a sign-in on /dashboard can
// say which campaign brought the visitor (lib/session.js sends it on sign-in).

export const CAMPAIGN_KEY = 'pigeonbox.campaign';
const CAMPAIGNS = ['sent_with', 'launch'];

const optedOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';

function referrerKind() {
  let host = '';
  try {
    host = document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    return 'other';
  }
  if (!host) return 'direct';
  if (host === location.hostname) return 'internal';
  if (/(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com|mail\.proton\.me|app\.fastmail\.com)$/.test(host)) return 'webmail';
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|kagi|brave)\.[a-z.]+$/.test(host)) return 'search';
  if (/(^|\.)(x\.com|twitter\.com|t\.co|linkedin\.com|lnkd\.in|reddit\.com|news\.ycombinator\.com|facebook\.com|threads\.net|bsky\.app|producthunt\.com)$/.test(host)) return 'social';
  return 'other';
}

/** The campaign this tab arrived with, if it is one PigeonBox runs. */
export function storedCampaign() {
  try {
    const value = sessionStorage.getItem(CAMPAIGN_KEY);
    return CAMPAIGNS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

let apiBase = null;
async function api() {
  if (apiBase !== null) return apiBase;
  const meta = document.querySelector('meta[name="pigeonbox-api"]')?.getAttribute('content')?.trim();
  let base = meta || '';
  if (!base) {
    try {
      base = (await (await fetch('/site-config.json', { credentials: 'omit' })).json()).cloudApiUrl || '';
    } catch {
      base = '';
    }
  }
  try {
    apiBase = base && new URL(base).protocol === 'https:' ? new URL(base).origin : '';
  } catch {
    apiBase = '';
  }
  return apiBase;
}

const params = new URLSearchParams(location.search);
const utm = {
  utmSource: params.get('utm_source')?.slice(0, 80) || undefined,
  utmMedium: params.get('utm_medium')?.slice(0, 80) || undefined,
  utmCampaign: params.get('utm_campaign')?.slice(0, 80) || storedCampaign() || undefined,
};
try {
  const campaign = params.get('utm_campaign')?.toLowerCase();
  if (campaign && CAMPAIGNS.includes(campaign)) sessionStorage.setItem(CAMPAIGN_KEY, campaign);
} catch {
  /* Storage blocked: attribution stops at this page. */
}

export async function sendWebEvent(event) {
  if (optedOut()) return;
  try {
    await fetch(`${await api()}/v1/events/web`, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      // The path only: never the query string or fragment, which can hold sign-in codes.
      body: JSON.stringify({ event, path: location.pathname, referrer: referrerKind(), ...utm }),
    });
  } catch {
    /* Analytics never affects the page. */
  }
}

if (!window.__pigeonboxPageAnalytics) {
  window.__pigeonboxPageAnalytics = true;
  void sendWebEvent('web_pageview');
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[data-install], a[href*="chromewebstore.google.com"]') : null;
    if (link) void sendWebEvent('web_install_clicked');
  }, { capture: true });
  window.addEventListener('pigeonbox:signin', () => { void sendWebEvent('web_signin_completed'); });
}
