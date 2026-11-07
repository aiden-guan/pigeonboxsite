// Public website: navigation and open-source installation links.
const $ = (selector) => document.querySelector(selector);

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

initSiteNavigation();
void initInstallLinks();
