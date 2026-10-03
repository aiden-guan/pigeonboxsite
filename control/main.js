// PigeonBox Cloud control plane: a small hash-routed app over the same-origin
// API. Each section is its own module, loaded on first visit.
import { api, finishSignIn, readSession, signOut, startSignIn } from '../lib/session.js';
import { button, card, clear, h, link, loading, note, toast } from './ui.js';

const SECTIONS = {
  overview: { title: 'Account overview', capability: 'cloud_mail_sync', load: () => import('./sections/overview.js') },
  billing: { title: 'Billing & subscription', capability: null, load: () => import('./sections/billing.js') },
  approvals: { title: 'Approvals', capability: null, load: () => import('./sections/approvals.js') },
  briefings: { title: 'Briefings', capability: 'cloud_automations', load: () => import('./sections/briefings.js') },
  connections: { title: 'Connected accounts', capability: 'cloud_mail_sync', load: () => import('./sections/connections.js') },
  views: { title: 'Smart Views', capability: 'cloud_automations', load: () => import('./sections/views.js') },
  automations: { title: 'Automations', capability: 'cloud_automations', load: () => import('./sections/automations.js') },
  sequences: { title: 'Sequences', capability: 'cloud_sequences', load: () => import('./sections/sequences.js') },
  contacts: { title: 'Contacts', capability: 'cloud_relationships', load: () => import('./sections/contacts.js') },
  activity: { title: 'Audit & activity', capability: null, load: () => import('./sections/activity.js') },
  documents: { title: 'Documents', capability: 'cloud_documents', load: () => import('./sections/documents.js') },
  team: { title: 'Team', capability: 'cloud_team', load: () => import('./sections/team.js') },
  preferences: { title: 'Sync & execution', capability: 'cloud_mail_sync', load: () => import('./sections/preferences.js') },
  memory: { title: 'Memory', capability: null, load: () => import('./sections/memory.js') },
  privacy: { title: 'Privacy & data', capability: 'cloud_mail_sync', load: () => import('./sections/privacy.js') },
  developers: { title: 'API & MCP', capability: 'cloud_mcp', load: () => import('./sections/developers.js') },
};

const view = document.getElementById('view');
const params = new URLSearchParams(location.search);
// One-time landing parameters (Google consent result, team invitation, Stripe return, sign-in return). Keep them, then clean the URL.
const landing = Object.fromEntries(['connected', 'missing', 'error', 'invite', 'checkout'].filter((name) => params.has(name)).map((name) => [name, params.get(name)]));
const signInReturn = params.has('code') || params.has('state') ? new URLSearchParams(params) : null;
if (Object.keys(landing).length || signInReturn) history.replaceState(null, '', `${location.pathname}${location.hash}`);

let ctx = null;
let renderToken = 0;

function currentSection() {
  const id = location.hash.replace(/^#/, '').split('/')[0];
  return SECTIONS[id] ? id : 'overview';
}

function locked(section, capability) {
  const isCloud = ctx.plan === 'cloud';
  return card(
    section.title,
    note(
      isCloud
        ? `${section.title} is not turned on for this PigeonBox Cloud server yet.`
        : `${section.title} is part of PigeonBox Cloud. PigeonBox on your computer keeps working without it.`,
      'info',
    ),
    isCloud ? null : h('div', { class: 'row' }, link('See plans', '/pricing', { class: 'btn btn-ghost' }), link('Billing & subscription', '#billing', { class: 'btn btn-primary' })),
    h('p', { class: 'hint' }, `Needs: ${capability.replace(/_/g, ' ')}.`),
  );
}

async function render({ focus = false } = {}) {
  const id = currentSection();
  const section = SECTIONS[id];
  const token = (renderToken += 1);
  document.title = `${section.title} · PigeonBox Cloud`;
  for (const anchor of document.querySelectorAll('.cp-nav a[data-section]')) {
    if (anchor.dataset.section === id) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
    // Never hide the current page or waiting approvals inside the collapsed group.
    if (anchor.dataset.section === id) anchor.closest('details')?.setAttribute('open', '');
  }
  closeMenu();
  clear(view, h('h1', { class: 'cp-title' }, section.title), loading());
  if (section.capability && !ctx.caps.has(section.capability)) {
    clear(view, h('h1', { class: 'cp-title' }, section.title), locked(section, section.capability));
    return;
  }
  try {
    const module = await section.load();
    const content = await module.render({ ...ctx, landing, section: id, rerender: () => render() });
    if (token !== renderToken) return;
    clear(view, h('h1', { class: 'cp-title' }, section.title), content);
  } catch (error) {
    if (token !== renderToken) return;
    if (error?.status === 401) return signedOut();
    clear(view, h('h1', { class: 'cp-title' }, section.title), note(error?.message || 'This section could not load.', 'error'), h('div', { class: 'row' }, button('Try again', () => render(), { variant: 'ghost' })));
  }
  if (focus) { view.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'auto' }); }
}

async function refreshCounts(force = false) {
  if (!ctx || (document.hidden && !force)) return;
  try {
    const { pending } = await api('/v1/approvals/list', { method: 'POST', body: { status: 'pending', limit: 1 } });
    const badge = document.querySelector('[data-count="approvals"]');
    badge.textContent = String(pending);
    badge.hidden = !pending;
    if (pending) badge.closest('details')?.setAttribute('open', '');
    badge.setAttribute('aria-label', `${pending} waiting`);
  } catch {
    // Counts are a convenience; the section shows errors itself.
  }
}

const INVITE_KEY = 'pigeonbox.invite';

function signedOut() {
  // An invitation link must survive the trip through sign-in.
  if (landing.invite) {
    try {
      sessionStorage.setItem(INVITE_KEY, landing.invite);
    } catch {
      // Storage blocked: the person can open the link again after signing in.
    }
  }
  const status = h('p', { class: 'hint', attrs: { role: 'status' } });
  clear(
    view,
    h('h1', { class: 'cp-title' }, 'PigeonBox Cloud'),
    card(
      'Sign in',
      h('p', {}, 'Sign in to manage connections, approvals, automations and privacy for PigeonBox Cloud.'),
      h('div', { class: 'row' }, button('Sign in', () => startSignIn(status, location.hash))),
      status,
    ),
  );
  document.getElementById('cp-signout').hidden = true;
}

const menu = document.querySelector('.cp-menu');
const side = document.getElementById('cp-side');
function closeMenu() {
  side.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
}
menu.addEventListener('click', () => {
  const open = !side.classList.contains('open');
  side.classList.toggle('open', open);
  menu.setAttribute('aria-expanded', String(open));
});
// Tapping outside the open drawer closes it.
document.querySelector('.cp-body').addEventListener('click', (event) => {
  if (side.classList.contains('open') && !menu.contains(event.target)) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && side.classList.contains('open')) {
    closeMenu();
    menu.focus();
  }
});

async function start() {
  if (signInReturn) {
    try {
      const back = await finishSignIn(signInReturn);
      if (back) history.replaceState(null, '', `${location.pathname}${back}`);
    } catch (error) {
      signedOut();
      toast(error?.message || 'Sign-in failed. Try again.', 'error');
      return;
    }
  }
  if (!readSession()) return signedOut();
  try {
    const saved = sessionStorage.getItem(INVITE_KEY);
    if (saved && !landing.invite) landing.invite = saved;
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    // Storage blocked.
  }
  try {
    const [me, capabilities] = await Promise.all([api('/v1/me'), api('/v1/capabilities')]);
    ctx = { api, me, plan: capabilities.plan, caps: new Set(capabilities.capabilities), refreshCounts: () => refreshCounts(true), toast };
  } catch (error) {
    if (!readSession()) return signedOut();
    clear(view, h('h1', { class: 'cp-title' }, 'PigeonBox Cloud'), note(error?.message || 'Could not reach PigeonBox Cloud.', 'error'));
    return;
  }
  document.getElementById('cp-email').textContent = ctx.me.user.email || '';
  const out = document.getElementById('cp-signout');
  out.hidden = false;
  out.addEventListener('click', async () => {
    await signOut();
    location.replace('/');
  });
  if (!location.hash && landing.invite) history.replaceState(null, '', '#team');
  if (!location.hash && (landing.connected || landing.error)) history.replaceState(null, '', '#connections');
  if (!location.hash && landing.checkout) history.replaceState(null, '', '#billing');
  window.addEventListener('hashchange', () => render({ focus: true }));
  await render();
  void refreshCounts(true);
  setInterval(refreshCounts, 60_000);
  document.addEventListener('visibilitychange', () => void refreshCounts());
}

void start();
