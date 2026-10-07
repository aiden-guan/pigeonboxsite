/**
 * Dashboard appearance. Light unless the visitor chose otherwise; the choice
 * lives in this browser only. Loaded as a classic script in <head> so the
 * first paint already has the right theme.
 */
(() => {
  const KEY = 'pigeonboxAppearance';
  const ORDER = ['light', 'dark', 'system'];
  const LABEL = { light: 'Light', dark: 'Dark', system: 'Match system' };
  const COLOR = { light: '#f3f0e8', dark: '#111214' };
  const root = document.documentElement;

  const read = () => {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'dark' || value === 'system' ? value : 'light';
    } catch {
      return 'light';
    }
  };

  /** Swap in one frame: colour transitions would otherwise animate every element at once. */
  let current = 'light';
  const apply = (value) => {
    current = value;
    const freeze = document.createElement('style');
    freeze.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.append(freeze);
    root.dataset.pbTheme = value;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      const scheme = meta.media.includes('dark') ? 'dark' : 'light';
      meta.content = COLOR[value === 'system' ? scheme : value];
    }
    void root.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => freeze.remove()));
    const button = document.getElementById('cp-theme');
    if (button) {
      const next = ORDER[(ORDER.indexOf(value) + 1) % ORDER.length];
      button.dataset.value = value;
      button.setAttribute('aria-label', `Appearance: ${LABEL[value]}. Switch to ${LABEL[next]}`);
      button.title = `Appearance: ${LABEL[value]}`;
    }
  };

  apply(read());
  document.addEventListener('DOMContentLoaded', () => {
    apply(current);
    document.getElementById('cp-theme')?.addEventListener('click', () => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      try { localStorage.setItem(KEY, next); } catch { /* Private windows: still switch for this visit. */ }
      apply(next);
    });
  });
  // Another dashboard tab changed it.
  window.addEventListener('storage', (event) => { if (event.key === KEY) apply(read()); });
})();
