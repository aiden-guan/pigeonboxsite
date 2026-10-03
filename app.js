// PigeonBox website: navigation, install links and the public Cloud price.
// The Cloud dashboard (/dashboard) is a separate app copied from pigeonbox-cloud.
const SESSION_KEY = 'pigeonbox.session';

const $ = (selector) => document.querySelector(selector);

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}
function initSiteNavigation() {
  const toggle = $('.menu-toggle');
  const nav = $('#site-nav');
  const closeMenu = () => {
    nav?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open menu');
  };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav?.classList.toggle('is-open', open);
  });
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      closeMenu();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
      closeMenu();
      toggle?.focus();
    }
  });
  document.addEventListener('click', event => {
    if (nav?.classList.contains('is-open') && !event.target.closest('.site-nav, .menu-toggle')) closeMenu();
  });
  matchMedia('(max-width: 920px)').addEventListener('change', closeMenu);
  // Cloud is invite-only: the dashboard handles sign-in. A signed-in tab says so.
  void loadSiteConfig().then(({ cloudDashboard }) => {
    if (!cloudDashboard) return;
    document.querySelectorAll('.account-link').forEach((link) => {
      link.hidden = false;
      link.href = '/dashboard';
      if (readSession()) link.textContent = 'Dashboard';
    });
  });
}

let siteConfig = null;
export function loadSiteConfig() {
  siteConfig ||= fetch('/site-config.json').then((response) => (response.ok ? response.json() : {})).catch(() => ({}));
  return siteConfig;
}

async function initInstallLinks() {
  const { installUrl, installLabel } = await loadSiteConfig();
  if (!installUrl || !/^https:\/\//.test(installUrl)) return;
  document.querySelectorAll('[data-install]').forEach((link) => {
    link.href = installUrl;
    if (installLabel && link.hasAttribute('data-install-label')) link.firstChild.textContent = installLabel + ' ';
  });
}

async function renderPublicPrice() {
  const output = $('#cloud-price');
  if (!output) return;
  // A configured Stripe price is not a public launch price (it may be test mode).
  // Only show one once site-config.json explicitly declares live public billing.
  const { cloudBilling, cloudApiUrl } = await loadSiteConfig();
  if (cloudBilling !== 'live' || !/^https:\/\//.test(cloudApiUrl ?? '')) return;
  try {
    const response = await fetch(`${cloudApiUrl}/v1/public/pricing`);
    if (!response.ok) return;
    const price = await response.json();
    if (!price.available || !Number.isInteger(price.unitAmount) || !price.currency || !price.interval) return;
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency.toUpperCase(), maximumFractionDigits: price.unitAmount % 100 === 0 ? 0 : 2 }).format(price.unitAmount / 100);
    output.innerHTML = '';
    output.append(document.createTextNode(formatted + ' '));
    const period = document.createElement('small');
    period.textContent = '/ ' + price.interval;
    output.append(period);
    $('#cloud-price-detail').textContent = 'Hosted AI, tracking and always-on work, billed through Stripe. Cancel from your account.';
    $('#cloud-cta').href = '/dashboard#billing';
    $('#cloud-cta').textContent = 'Subscribe from your dashboard →';
  } catch {
    // Missing billing configuration is an early-access state, not a page error.
  }
}

const page = document.body.dataset.page;
initSiteNavigation();
void initInstallLinks();
if (page === 'pricing') void renderPublicPrice();
