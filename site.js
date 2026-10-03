// Site-wide interaction layer: ⌘K command palette, single-key navigation,
// the PIDGY:// terminal drawer, header state and section reveals.
// Account, auth and billing behavior stays in app.js.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const GITHUB = 'https://github.com/aiden-guan/pigeonbox';
const SHORTCUT_KEY = 'pigeonbox.shortcuts';

const installHref = () => document.querySelector('[data-install]')?.href || `${GITHUB}#-install`;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function shortcutsEnabled() {
  try { return localStorage.getItem(SHORTCUT_KEY) !== 'off'; } catch { return true; }
}
function setShortcuts(on) {
  try { localStorage.setItem(SHORTCUT_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}
function pidgy(state = 'idle', extra = '') {
  return el('span', { class: `pidgy ${extra}`.trim(), 'data-state': state, 'aria-hidden': 'true' });
}

export function toast(message, state = 'idle') {
  document.querySelector('.toast')?.remove();
  const node = el('div', { class: 'toast', role: 'status' }, pidgy(state), el('span', { text: message }));
  document.body.append(node);
  setTimeout(() => node.remove(), 2500);
}

function go(href) {
  const url = new URL(href, location.href);
  if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
    const target = document.querySelector(url.hash);
    if (target) {
      target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', url.hash);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      return;
    }
  }
  if (url.origin !== location.origin) window.open(url.href, '_blank', 'noopener');
  else location.assign(url.href);
}

/* ---------------- Answers ---------------- */

const ANSWERS = {
  local: {
    title: 'What stays local?',
    body: ['Everything, by default. Index, drafts and settings live in your browser. On-device models and Ollama keep AI on your machine.', 'Add your own provider key, and that provider sees what you send it.'],
    link: ['/privacy', 'Privacy'],
  },
  cloud: {
    title: 'What is Cloud?',
    body: ['The same extension, hosted. Connect Google and it keeps sorting and preparing while Gmail is closed. Every send waits for you.', 'Cloud is on its way. Join the waitlist.'],
    link: ['/waitlist', 'Cloud beta'],
  },
  send: {
    title: 'Does PigeonBox send email for me?',
    body: ['No. You press Send. In Cloud, every send waits for your approval.'],
    link: ['/security', 'Security'],
  },
  track: {
    title: 'Is an open a read receipt?',
    body: ['No. It’s a signal. Privacy proxies can hide or fake it, so PigeonBox says “Open detected.”'],
    link: ['/privacy#tracking', 'Tracking'],
  },
};

// Return focus to where it was; never leave it inside a hidden dialog.
function restoreFocus(previous, fallback) {
  document.activeElement?.blur?.();
  const target = previous && previous !== document.body && document.contains(previous) ? previous : fallback && document.querySelector(fallback);
  target?.focus?.({ preventScroll: true });
}

/* ---------------- Command palette ---------------- */

const baseCommands = () => [
  { group: 'Go to', label: 'Product', glyph: '◇', hint: 'P', run: () => go('/#dispatch') },
  { group: 'Go to', label: 'Local', glyph: '◇', hint: 'L', run: () => go('/local') },
  { group: 'Go to', label: 'Cloud beta', glyph: '◇', hint: 'C', run: () => go('/waitlist') },
  { group: 'Go to', label: 'Pricing', glyph: '◇', hint: '$', run: () => go('/pricing') },
  { group: 'Go to', label: 'Docs', glyph: '◇', hint: 'D', run: () => go('/docs') },
  { group: 'Go to', label: 'Privacy', glyph: '◇', run: () => go('/privacy') },
  { group: 'Go to', label: 'Security', glyph: '◇', run: () => go('/security') },
  { group: 'Go to', label: 'GitHub', glyph: '↗', hint: 'external', run: () => go(GITHUB), keywords: 'source code repository open' },
  { group: 'Actions', label: 'Install Local', glyph: '↓', hint: 'free', run: () => go(installHref()), keywords: 'download chrome extension setup' },
  { group: 'Actions', label: 'Copy install command', glyph: '$', run: copyInstall, keywords: 'git clone npm terminal' },
  { group: 'Ask Pigeon', label: 'What stays local?', glyph: '?', answer: 'local', keywords: 'privacy data browser' },
  { group: 'Ask Pigeon', label: 'What is Cloud?', glyph: '?', answer: 'cloud', keywords: 'beta hosted always-on' },
  { group: 'Ask Pigeon', label: 'Does PigeonBox send email for me?', glyph: '?', answer: 'send', keywords: 'auto send approval' },
  { group: 'Ask Pigeon', label: 'Is an open a read receipt?', glyph: '?', answer: 'track', keywords: 'tracking opens clicks' },
  { group: 'Pidgy', label: 'Open PIDGY:// terminal', glyph: '>', hint: '`', run: () => openTerminal(), keywords: 'console easter egg' },
  { group: 'Pidgy', label: shortcutsEnabled() ? 'Turn off single-key shortcuts' : 'Turn on single-key shortcuts', glyph: '⌥', run: toggleShortcuts, keywords: 'keyboard accessibility' },
];

let pageCommands = [];
document.addEventListener('pb:commands', (event) => { pageCommands = event.detail || []; });

const INSTALL_CMD = 'git clone https://github.com/aiden-guan/pigeonbox.git && cd pigeonbox && npm run setup -- --open';
async function copyInstall() {
  try {
    await navigator.clipboard.writeText(INSTALL_CMD);
    toast('Install command copied', 'route');
  } catch {
    toast('Copy failed. See /local for the command.', 'alert');
  }
}
function toggleShortcuts() {
  const next = !shortcutsEnabled();
  setShortcuts(next);
  toast(next ? 'Single-key shortcuts on' : 'Single-key shortcuts off', next ? 'idle' : 'alert');
}

let palette = null;
let paletteReturn = null;

function buildPalette() {
  const input = el('input', {
    type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list',
    'aria-autocomplete': 'list', 'aria-label': 'Search commands', placeholder: 'Type a command or a question…',
    autocomplete: 'off', spellcheck: 'false',
  });
  const list = el('div', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': 'Commands' });
  const answer = el('section', { class: 'palette-answer', 'aria-live': 'polite', hidden: '' });
  const sprite = pidgy('idle');
  const foot = el('div', { class: 'palette-foot', 'aria-hidden': 'true' },
    el('span', {}, el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), ' move'),
    el('span', {}, el('kbd', { text: '↵' }), ' run'),
    el('span', {}, el('kbd', { text: 'esc' }), ' close'),
    el('span', {}, el('kbd', { text: isMac ? '⌘K' : 'Ctrl K' }), ' anywhere'),
  );
  const panel = el('div', { class: 'palette-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' },
    el('div', { class: 'palette-search' }, sprite, input), list, answer, foot);
  const root = el('div', { class: 'palette', hidden: '' }, el('div', { class: 'palette-scrim', onclick: closePalette }), panel);
  document.body.append(root);

  let items = [];
  let active = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    const all = [...pageCommands, ...baseCommands()];
    items = all.filter((c) => !q || `${c.label} ${c.group} ${c.keywords || ''}`.toLowerCase().includes(q));
    active = Math.min(active, Math.max(items.length - 1, 0));
    list.replaceChildren();
    if (!items.length) {
      list.append(el('div', { class: 'palette-empty' }, pidgy('search'), el('span', { text: 'Pidgy searched the whole route. Nothing by that name.' })));
      input.removeAttribute('aria-activedescendant');
      sprite.dataset.state = 'search';
      return;
    }
    sprite.dataset.state = q ? 'search' : 'idle';
    let group = '';
    items.forEach((cmd, i) => {
      if (cmd.group !== group) {
        group = cmd.group;
        list.append(el('div', { class: 'palette-group', role: 'presentation', text: group }));
      }
      const option = el('div', { class: 'palette-option', role: 'option', id: `pal-${i}`, 'aria-selected': String(i === active) },
        el('span', { class: 'glyph', 'aria-hidden': 'true', text: cmd.glyph || '·' }),
        el('span', { text: cmd.label }),
        cmd.hint ? el('span', { class: 'hint', 'aria-hidden': 'true', text: cmd.hint }) : null);
      option.addEventListener('click', () => { active = i; run(); });
      option.addEventListener('pointermove', () => { if (active !== i) { active = i; highlight(); } });
      list.append(option);
    });
    highlight();
  };
  const highlight = () => {
    list.querySelectorAll('[role="option"]').forEach((node, i) => node.setAttribute('aria-selected', String(i === active)));
    const current = list.querySelector(`#pal-${active}`);
    if (current) {
      input.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView({ block: 'nearest' });
    }
  };
  const showAnswer = (key) => {
    const data = ANSWERS[key];
    answer.replaceChildren(
      el('p', { class: 'label' }, pidgy('search', 'pidgy-sm'), el('span', { text: `Ask Pigeon · ${data.title}` })),
      ...data.body.map((text) => el('p', { text })),
      el('p', {}, el('a', { href: data.link[0], text: `${data.link[1]} →` })),
    );
    answer.hidden = false;
  };
  const run = () => {
    const cmd = items[active];
    if (!cmd) return;
    if (cmd.answer) { showAnswer(cmd.answer); return; }
    closePalette(false);
    cmd.run();
  };

  input.addEventListener('input', () => { active = 0; answer.hidden = true; render(); });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); active = (active + 1) % Math.max(items.length, 1); highlight(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); active = (active - 1 + items.length) % Math.max(items.length, 1); highlight(); }
    else if (event.key === 'Home' && !input.value) { event.preventDefault(); active = 0; highlight(); }
    else if (event.key === 'End' && !input.value) { event.preventDefault(); active = items.length - 1; highlight(); }
    else if (event.key === 'Enter' && document.activeElement === input) { event.preventDefault(); run(); }
    else if (event.key === 'Escape') { event.preventDefault(); if (!answer.hidden) { answer.hidden = true; input.focus(); } else closePalette(); }
    else if (event.key === 'Tab') {
      const focusables = [input, ...answer.querySelectorAll('a')].filter((n) => !n.closest('[hidden]'));
      const i = focusables.indexOf(document.activeElement);
      event.preventDefault();
      focusables[(i + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
    }
  });

  return { root, input, render, answer, showAnswer };
}

export function openPalette(query = '') {
  palette ||= buildPalette();
  if (!palette.root.hidden) { palette.input.focus(); return; }
  paletteReturn = document.activeElement;
  palette.input.value = query;
  palette.answer.hidden = true;
  palette.render();
  palette.root.hidden = false;
  document.querySelectorAll('[data-palette-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  if (!reduceMotion.matches) {
    palette.root.classList.add('is-entering');
    setTimeout(() => palette?.root.classList.remove('is-entering'), 220);
  }
  palette.input.focus();
}
function closePalette(restore = true) {
  if (!palette || palette.root.hidden) return;
  palette.root.hidden = true;
  document.querySelectorAll('[data-palette-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  if (restore) restoreFocus(paletteReturn, null);
}

/* ---------------- PIDGY:// terminal ---------------- */

let term = null;
let termReturn = null;
const TERM_PAGES = { product: '/', home: '/', local: '/local', cloud: '/waitlist', pricing: '/pricing', docs: '/docs', privacy: '/privacy', security: '/security', terms: '/terms' };

function buildTerminal() {
  const log = el('div', { class: 'term-log', role: 'log', 'aria-live': 'polite' });
  const input = el('input', { id: 'term-input', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Terminal command' });
  const sprite = pidgy('route');
  const close = el('button', { type: 'button', text: 'esc', 'aria-label': 'Close terminal' });
  const root = el('section', { class: 'term', role: 'dialog', 'aria-label': 'PIDGY terminal', hidden: '' },
    el('div', { class: 'term-bar' }, sprite, el('span', { text: 'PIDGY:// DISPATCH CONSOLE' }), close),
    log,
    el('form', { class: 'term-form' }, el('label', { for: 'term-input', text: 'pidgy@dispatch:~$' }), input));

  const print = (text, cls = '') => { log.append(el('p', { class: cls, text })); log.scrollTop = log.scrollHeight; };
  const printLink = (prefix, href, label) => {
    log.append(el('p', {}, prefix, el('a', { href, text: label })));
    log.scrollTop = log.scrollHeight;
  };
  const history = [];
  let cursor = 0;

  const commands = {
    help: () => print('commands: help · local · cloud · privacy · install · about · pidgy · go <page> · shortcuts · clear · exit'),
    local: () => {
      print('LOCAL  free · open source · no account · no Gmail API OAuth');
      printLink('       → ', '/local', '/local');
    },
    cloud: () => {
      print('CLOUD  private beta · hosted · works while Gmail is closed', 'ok');
      printLink('       → ', '/waitlist', '/waitlist');
    },
    privacy: () => {
      print('local   stays in your browser');
      print('cloud   processed, never logged · metadata + encrypted summaries');
      printLink('             → ', '/privacy', '/privacy');
    },
    install: () => {
      print(`$ ${INSTALL_CMD}`);
      print('then chrome://extensions → Developer mode → Load unpacked → apps/extension/dist');
      printLink('→ ', installHref(), 'full install instructions');
    },
    about: () => print('PigeonBox. Gmail, sorted. Courier: Pidgy.'),
    pidgy: () => {
      print('      __');
      print('  ___( o)>   coo.');
      print('  \\ <_. )    Pidgy, courier. Sorts the post, carries drafts,');
      print('   `---\'     never presses Send.');
      sprite.dataset.state = 'alert';
      setTimeout(() => { sprite.dataset.state = 'route'; }, 1600);
    },
    shortcuts: () => { toggleShortcuts(); print(`single-key shortcuts: ${shortcutsEnabled() ? 'on' : 'off'}`); },
    clear: () => log.replaceChildren(),
    exit: () => closeTerminal(),
    sudo: (args) => print(args.join(' ').includes('send') ? 'Nice try. PigeonBox never sends on its own. You press Send.' : 'Permission granted to… nothing. This is a website.'),
    go: (args) => {
      const page = TERM_PAGES[(args[0] || '').toLowerCase()];
      if (!page) { print(`go: unknown page. try: ${Object.keys(TERM_PAGES).join(' ')}`); return; }
      print(`routing to ${page}…`, 'ok');
      setTimeout(() => location.assign(page), reduceMotion.matches ? 0 : 280);
    },
    ls: () => print(Object.keys(TERM_PAGES).join('  ')),
    coo: () => print('coo coo.'),
  };
  commands.cd = commands.go;

  root.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    history.push(raw);
    cursor = history.length;
    log.append(el('p', { class: 'in' }, el('b', { text: '$ ' }), raw));
    const [name, ...args] = raw.split(/\s+/);
    const fn = commands[name.toLowerCase()];
    if (fn) fn(args);
    else print(`${name}: command not found. type "help".`);
    log.scrollTop = log.scrollHeight;
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) { event.preventDefault(); cursor = Math.max(0, cursor - 1); input.value = history[cursor]; }
    else if (event.key === 'ArrowDown' && history.length) { event.preventDefault(); cursor = Math.min(history.length, cursor + 1); input.value = history[cursor] || ''; }
  });
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeTerminal(); } });
  close.addEventListener('click', () => closeTerminal());

  document.body.append(root);
  print('PIDGY:// dispatch console. type "help".', 'ok');
  return { root, input };
}

export function openTerminal() {
  term ||= buildTerminal();
  termReturn = document.activeElement;
  term.root.hidden = false;
  document.querySelectorAll('[data-term-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  if (!reduceMotion.matches) {
    term.root.classList.add('is-entering');
    setTimeout(() => term?.root.classList.remove('is-entering'), 260);
  }
  term.input.focus();
}
function closeTerminal() {
  if (!term || term.root.hidden) return;
  term.root.hidden = true;
  document.querySelectorAll('[data-term-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  restoreFocus(termReturn, '[data-term-open]');
}

/* ---------------- Keyboard ---------------- */

const NAV_KEYS = { p: '/#dispatch', l: '/local', c: '/waitlist', $: '/pricing', d: '/docs' };

function typingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k' && !event.repeat) {
    event.preventDefault();
    if (palette && !palette.root.hidden) closePalette();
    else openPalette();
    return;
  }
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (typingTarget(event.target)) return;
  if (palette && !palette.root.hidden) return;
  if (term && !term.root.hidden) return;
  if (event.key === '`') { event.preventDefault(); openTerminal(); return; }
  if (!shortcutsEnabled()) return;
  if (event.target instanceof HTMLElement && event.target.closest('[data-local-keys]')) return;
  if (event.key === '/' || event.key === '?') { event.preventDefault(); openPalette(); return; }
  const dest = NAV_KEYS[event.key.length === 1 ? event.key.toLowerCase() : ''];
  if (!dest) return;
  event.preventDefault();
  const here = location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  if (dest.includes('#')) go(dest);
  else if (here === dest) {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    toast(`Already here · ${dest}`, 'idle');
  } else location.assign(dest);
});

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-palette-open]')) { event.preventDefault(); openPalette(); }
  else if (target?.closest('[data-term-open]')) { event.preventDefault(); openTerminal(); }
  const ask = target?.closest('[data-ask]');
  if (ask) { event.preventDefault(); openPalette(); palette.showAnswer(ask.dataset.ask); }
  const copy = target?.closest('[data-copy]');
  if (copy) {
    const text = document.getElementById(copy.dataset.copy)?.textContent.replace(/^\$ /gm, '').trim();
    navigator.clipboard?.writeText(text || '').then(() => {
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
    }, () => toast('Copy failed', 'alert'));
  }
});

/* Platform-aware key labels. */
document.querySelectorAll('[data-mod-key]').forEach((node) => { node.textContent = isMac ? '⌘K' : 'Ctrl K'; });

/* ---------------- Header + reveals ---------------- */

const header = document.querySelector('.site-header');
if (header) {
  const sentinel = el('div', { 'aria-hidden': 'true' });
  sentinel.className = 'sr-only';
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(sentinel);
}

if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  const targets = [...document.querySelectorAll('[data-reveal]')];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  const fold = innerHeight * 0.92;
  document.documentElement.classList.add('motion');
  targets.forEach((node) => {
    // Content already on screen at load never hides: no flash, no layout shift.
    if (node.getBoundingClientRect().top < fold) return;
    node.classList.add('reveal');
    observer.observe(node);
  });
}

/* ---------------- Halftone art (lazy) ---------------- */

let halftone = null;
const loadHalftone = () => (halftone ||= import('/halftone.js'));
const artCanvases = [...document.querySelectorAll('canvas[data-halftone]')];
if (artCanvases.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    loadHalftone().then((m) => m.mount()).catch(() => undefined);
  }, { rootMargin: '400px 0px' });
  artCanvases.forEach((c) => io.observe(c));
}

/* Footer perch: Pidgy takes a lap of the night sky. */
document.querySelector('[data-coo]')?.addEventListener('click', (event) => {
  const bird = event.currentTarget.querySelector('.pidgy');
  if (bird) { bird.dataset.state = 'alert'; setTimeout(() => { bird.dataset.state = 'idle'; }, 1400); }
  const sky = document.querySelector('canvas[data-halftone="night"]');
  const field = sky?.field;
  if (field && !reduceMotion.matches) field.scene.flyBy(field.state);
  toast('coo. all mail accounted for.', 'alert');
});
