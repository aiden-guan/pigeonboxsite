// PigeonBox Cloud control plane: a small hash-routed app over the same-origin
// API. Each section is its own module, loaded on first visit. Decoration
// (motion, halftone prints) is layered on afterwards and never blocks a page.
import { api, finishSignIn, readSession, signOut, startSignIn } from '../lib/session.js';
import { ago, arrowLink, button, clear, emptyState, h, link, notice, pageLoading, plural, postmarkDate, surface, tag, toast } from './ui.js';
import { enter, leave, placeMarker } from './motion.js';
import { routeHealth } from './shared.js';

/**
 * Sections in rail order. `title` is the rail label (and the page's place in
 * the eyebrow); `heading` and `lede` set the masthead.
 */
const SECTIONS = {
  overview: { title: 'Account overview', group: 'Account', heading: 'Your PigeonBox', lede: 'Everything moving through your Cloud workspace.', capability: 'cloud_mail_sync', load: () => import('./sections/overview.js') },
  billing: { title: 'Billing & subscription', group: 'Account', heading: 'Account ledger', lede: 'Your plan, its renewal, and what Cloud has used.', capability: null, load: () => import('./sections/billing.js') },
  connections: { title: 'Connected accounts', group: 'Account', heading: 'Mail routes', lede: 'Google accounts connected to PigeonBox Cloud, and how each one is syncing.', capability: 'cloud_mail_sync', load: () => import('./sections/connections.js') },
  privacy: { title: 'Privacy & data', group: 'Account', heading: 'What Cloud keeps', lede: 'What PigeonBox Cloud stores about your mail, how it is sealed, and how to remove it. Local PigeonBox data in your browser is separate and never shown here.', capability: 'cloud_mail_sync', load: () => import('./sections/privacy.js') },
  team: { title: 'Team', group: 'Account', heading: 'Shared desk', lede: 'Share a thread’s summary with teammates, assign it, and discuss it. The email itself never leaves the sharer’s mailbox.', capability: 'cloud_team', load: () => import('./sections/team.js') },
  developers: { title: 'API & MCP', group: 'Account', heading: 'Service entrance', lede: 'Connect tools to PigeonBox with scoped tokens and signed webhooks. Everything they do is audited.', capability: 'cloud_mcp', load: () => import('./sections/developers.js') },
  preferences: { title: 'Sync & execution', group: 'Preferences', heading: 'Working hours & routines', lede: 'When PigeonBox works for you, and what it prepares in the background.', capability: 'cloud_mail_sync', load: () => import('./sections/preferences.js') },
  memory: { title: 'Memory', group: 'Preferences', heading: 'What Pidgy remembers', lede: 'The useful details you should not have to explain twice. Correct or forget any of it.', capability: null, load: () => import('./sections/memory.js') },
  activity: { title: 'Audit & activity', group: 'Preferences', heading: 'Dispatch log', lede: 'Everything done on your behalf, with who asked for it and why.', capability: null, load: () => import('./sections/activity.js') },
  automations: { title: 'Automations', group: 'Advanced workflows', heading: 'Standing orders', lede: 'Plain-language rules that run in Shadow Mode until you turn them on.', capability: 'cloud_automations', load: () => import('./sections/automations.js') },
  sequences: { title: 'Sequences', group: 'Advanced workflows', heading: 'Sequences', lede: 'Personal sequences for a small list of people you would write to anyway. Every batch waits for your approval, and replies stop it for that person.', capability: 'cloud_sequences', load: () => import('./sections/sequences.js') },
  views: { title: 'Smart Views', group: 'Advanced workflows', heading: 'Smart Views', lede: 'Describe mail in your own words. PigeonBox turns it into rules you can read.', capability: 'cloud_automations', load: () => import('./sections/views.js') },
  contacts: { title: 'Contacts', group: 'Advanced workflows', heading: 'Correspondents', lede: 'Built from dates, counts and open promises in your synced mail. No hidden scores: every item says why it is here.', capability: 'cloud_relationships', load: () => import('./sections/contacts.js') },
  documents: { title: 'Documents', group: 'Advanced workflows', heading: 'Tracked documents', lede: 'PDFs read in PigeonBox’s viewer. You see who opened what, never more than the viewer can observe.', capability: 'cloud_documents', load: () => import('./sections/documents.js') },
  approvals: { title: 'Approvals', group: 'Advanced workflows', heading: 'Waiting for your say', lede: 'PigeonBox never sends email or invites people on its own. Everything that needs your say waits here, in Gmail’s side panel and in the extension.', capability: null, load: () => import('./sections/approvals.js') },
  briefings: { title: 'Briefings', group: 'Advanced workflows', heading: 'Briefings', lede: 'Built from your synced mail and calendar. Every line links to where it came from.', capability: 'cloud_automations', load: () => import('./sections/briefings.js') },
};
Object.keys(SECTIONS).forEach((id, position) => (SECTIONS[id].n = String(position + 1).padStart(2, '0')));

const view = document.getElementById('view');
const nav = document.getElementById('cp-nav');
const marker = nav.querySelector('.cp-nav-marker');
const announcer = document.getElementById('cp-announce');
const params = new URLSearchParams(location.search);
// Providers may return failures in the query or fragment. Keep only codes for
// fixed notices; never display their raw description, and clean callback URLs.
const errorFragment = new URLSearchParams(location.hash.slice(1));
const hasErrorFragment = errorFragment.has('error') || errorFragment.has('error_code');
const hasSignInError = params.has('error') || params.has('error_code') || hasErrorFragment;
const signInErrorCode = params.get('error_code') ?? (hasErrorFragment ? errorFragment.get('error_code') : null);
// One-time landing parameters (Google consent result, team invitation, Stripe return, sign-in return). Keep them, then clean the URL.
const landing = Object.fromEntries(['connected', 'missing', 'error', 'invite', 'checkout'].filter((name) => params.has(name)).map((name) => [name, params.get(name)]));
const signInReturn = params.has('code') || params.has('state') ? new URLSearchParams(params) : null;
if (Object.keys(landing).length || signInReturn || hasSignInError) history.replaceState(null, '', `${location.pathname}${hasErrorFragment ? '' : location.hash}`);

let ctx = null;
let renderToken = 0;

function currentSection() {
  const id = location.hash.replace(/^#/, '').split('/')[0];
  return SECTIONS[id] ? id : 'overview';
}

// ---------------------------------------------------------------------------
// Page frame
// ---------------------------------------------------------------------------

function masthead({ n, path, heading, lede = null, scene = null }) {
  const aside = h('div', { class: 'mh-aside' });
  const art = scene ? h('canvas', { class: 'mh-art', dataset: { scene }, attrs: { 'aria-hidden': 'true' } }) : null;
  const el = h(
    'header',
    { class: 'masthead' },
    h(
      'div',
      { class: 'mh-rule' },
      h('p', { class: 'eyebrow' }, n ? h('span', { class: 'mh-index' }, n) : null, h('span', { class: 'mh-path' }, path)),
      h('span', { class: 'mh-date', attrs: { 'aria-hidden': 'true' } }, postmarkDate()),
    ),
    h('div', { class: 'mh-grid' }, h('div', { class: 'mh-copy' }, h('h1', { class: 'mh-title' }, heading), lede ? h('p', { class: 'mh-lede' }, lede) : null), aside),
    art,
  );
  return { el, aside, art };
}

const sectionMasthead = (id) => {
  const section = SECTIONS[id];
  return masthead({ n: section.n, path: `${section.group} / ${section.title}`, heading: section.heading, lede: section.lede, scene: id === 'overview' ? null : id });
};

/** Section modules return a node, or { content, aside, art, className } to dress the masthead. */
function dress(head, result) {
  if (!result || result instanceof Node || Array.isArray(result)) return result;
  if (result.aside) {
    clear(head.aside, result.aside);
    head.el.classList.add('has-aside');
  }
  if (result.art) {
    head.art?.remove();
    head.el.append(result.art);
  }
  if (result.className) head.el.classList.add(result.className);
  return result.content;
}

function decorate() {
  // Prints are progressive enhancement: loaded after the page, never awaited.
  import('./halftone.js').then((halftone) => halftone.mount(view)).catch(() => undefined);
}

function paint(head, body, { settle = false } = {}) {
  const page = h('div', { class: 'page' }, body);
  if (settle && head.el.isConnected) view.querySelector(':scope > .page')?.replaceWith(page);
  else clear(view, head.el, page);
  enter(view, { masthead: !settle });
  decorate();
}

function lockedBody(section) {
  const isCloud = ctx.plan === 'cloud';
  return emptyState({
    state: 'lantern',
    title: isCloud ? `${section.title} is not turned on for this PigeonBox Cloud server yet.` : `${section.title} is part of PigeonBox Cloud.`,
    text: isCloud ? 'Nothing is wrong with your account. This server does not offer it yet.' : 'PigeonBox on your computer keeps working without it.',
    actions: [
      isCloud ? null : link('See plans', '/pricing', { class: 'btn btn-ghost' }),
      isCloud ? null : link('Billing & subscription', '#billing', { class: 'btn btn-primary' }),
      tag(`Needs: ${section.capability.replace(/_/g, ' ')}`),
    ].filter(Boolean),
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

async function render({ focus = false } = {}) {
  const id = currentSection();
  const section = SECTIONS[id];
  const token = (renderToken += 1);
  document.title = `${section.title} · PigeonBox Cloud`;
  updateNav(id);
  closeMenu();
  const head = sectionMasthead(id);

  if (section.capability && !ctx.caps.has(section.capability)) {
    head.art?.setAttribute('data-scene', 'locked');
    paint(head, lockedBody(section));
    return finish(id, focus);
  }

  // The current page dims at once; a skeleton follows only if loading is slow.
  const first = !view.querySelector(':scope > .page') || view.querySelector('.loading-page');
  leave(view);
  let skeleton = false;
  const slow = setTimeout(() => {
    if (token !== renderToken) return;
    skeleton = true;
    paint(head, pageLoading(`Loading ${section.title}…`));
  }, first ? 0 : 200);

  try {
    const module = await section.load();
    const result = await module.render({ ...ctx, landing, section: id, rerender: () => render() });
    if (token !== renderToken) return;
    clearTimeout(slow);
    paint(head, dress(head, result), { settle: skeleton });
  } catch (error) {
    if (token !== renderToken) return;
    clearTimeout(slow);
    if (error?.status === 401) return signedOut();
    paint(
      head,
      notice({
        tone: 'bad',
        label: 'Returned',
        title: error?.message || 'This section could not load.',
        text: 'PigeonBox Cloud did not answer as expected. Nothing was changed.',
        actions: [button('Try again', () => render(), { variant: 'ghost' })],
      }),
      { settle: skeleton },
    );
  }
  finish(id, focus);
}

function finish(id, focus) {
  announcer.textContent = `${SECTIONS[id].title} loaded`;
  if (focus) {
    view.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

// ---------------------------------------------------------------------------
// Rail
// ---------------------------------------------------------------------------

function updateNav(id) {
  let current = null;
  for (const anchor of nav.querySelectorAll('a[data-section]')) {
    if (anchor.dataset.section === id) {
      anchor.setAttribute('aria-current', 'page');
      // Never hide the current page inside the collapsed group.
      anchor.closest('details')?.setAttribute('open', '');
      current = anchor;
    } else anchor.removeAttribute('aria-current');
  }
  document.getElementById('cp-top-section').textContent = SECTIONS[id].title;
  requestAnimationFrame(() => placeMarker(marker, current));
}

function markLocked() {
  for (const anchor of nav.querySelectorAll('a[data-section]')) {
    const capability = SECTIONS[anchor.dataset.section]?.capability;
    if (capability && !ctx.caps.has(capability)) {
      anchor.dataset.locked = '';
      anchor.title = 'Part of PigeonBox Cloud';
    }
  }
}

function showRouteHealth(data) {
  const health = routeHealth(data);
  const box = document.getElementById('cp-status');
  const mark = document.getElementById('cp-status-mark');
  mark.className = `pill pill-${health.tone}`;
  mark.textContent = health.phrase;
  document.getElementById('cp-status-detail').textContent = health.live.length
    ? `${plural(health.live.length, 'account')}${health.lastSync ? ` · synced ${ago(health.lastSync)}` : ''}`
    : 'Connect Google to start';
  box.hidden = false;
}

async function refreshCounts(force = false) {
  if (!ctx || (document.hidden && !force)) return;
  try {
    const { pending } = await api('/v1/approvals/list', { method: 'POST', body: { status: 'pending', limit: 1 } });
    for (const badge of document.querySelectorAll('[data-count="approvals"]')) {
      badge.textContent = String(pending);
      badge.hidden = !pending;
      badge.setAttribute('aria-label', `${pending} waiting`);
    }
    document.getElementById('cp-top-count').hidden = !pending;
    document.getElementById('cp-top-count').setAttribute('aria-label', `${plural(pending, 'approval')} waiting`);
    if (pending) nav.querySelector('details')?.setAttribute('open', '');
  } catch {
    // Counts are a convenience; the section shows errors itself.
  }
}

// ---------------------------------------------------------------------------
// Signed out, unreachable
// ---------------------------------------------------------------------------

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
  document.body.dataset.auth = 'out';
  const status = h('p', { class: 'hint', attrs: { role: 'status' } });
  const head = masthead({ n: '00', path: 'PigeonBox Cloud / Sign in', heading: 'Your Cloud desk', lede: 'Connections, approvals, automations and privacy for PigeonBox Cloud, in one place.', scene: 'connections' });
  paint(
    head,
    [hasSignInError ? notice(signInErrorCode === 'signup_disabled' ? {
      label: 'Cloud beta',
      title: 'An invitation is needed',
      text: 'Cloud beta is currently invite-only. Sign in with an invited account, or join the waitlist for access.',
      actions: [arrowLink('Join the waitlist', 'https://usepigeonbox.com/waitlist')],
    } : {
      label: 'Sign in',
      title: 'Sign-in was not completed',
      text: 'You can try signing in again. Use the Google account from your invitation if you are joining the Cloud beta.',
    }) : null,
    h(
      'div',
      { class: 'grid-2' },
      surface(
        'stub',
        { title: 'Sign in', eyebrow: 'Account' },
        h('p', { class: 'muted' }, 'Sign in to manage connections, approvals, automations and privacy for PigeonBox Cloud.'),
        h('div', { class: 'row' }, button('Sign in', () => startSignIn(status, location.hash))),
        status,
      ),
      surface(
        'slip',
        { title: 'Not on Cloud yet?' },
        h('p', { class: 'muted' }, 'PigeonBox works locally in Gmail without an account. Cloud adds sync while Gmail is closed, hosted AI, and approvals from anywhere.'),
        h('div', { class: 'row' }, arrowLink('Compare plans', '/pricing')),
      ),
    )],
  );
  document.getElementById('cp-signout').hidden = true;
}

function unreachable(error) {
  const head = masthead({ n: '00', path: 'PigeonBox Cloud', heading: 'PigeonBox Cloud', scene: 'locked' });
  paint(
    head,
    notice({
      tone: 'bad',
      label: 'Returned',
      title: error?.message || 'Could not reach PigeonBox Cloud.',
      text: 'Your session is kept. Reload the page to try again.',
      actions: [button('Reload', () => location.reload(), { variant: 'ghost' })],
    }),
  );
}

// ---------------------------------------------------------------------------
// Drawer (small screens)
// ---------------------------------------------------------------------------

const menu = document.querySelector('.cp-menu');
const side = document.getElementById('cp-side');
const scrim = document.getElementById('cp-scrim');
const body = document.querySelector('.cp-desk');
const narrow = matchMedia('(max-width: 900px)');

function closeMenu() {
  if (!side.classList.contains('open')) return;
  side.classList.remove('open');
  scrim.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  body.inert = false;
}
function openMenu() {
  side.classList.add('open');
  scrim.classList.add('open');
  menu.setAttribute('aria-expanded', 'true');
  body.inert = true;
  (nav.querySelector('a[aria-current="page"]') ?? nav.querySelector('a'))?.focus({ preventScroll: true });
  requestAnimationFrame(() => placeMarker(marker, nav.querySelector('a[aria-current="page"]'), { instant: true }));
}
menu.addEventListener('click', () => (side.classList.contains('open') ? closeMenu() : openMenu()));
scrim.addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && side.classList.contains('open')) {
    closeMenu();
    menu.focus();
  }
});
narrow.addEventListener('change', () => {
  closeMenu();
  placeMarker(marker, nav.querySelector('a[aria-current="page"]'), { instant: true });
});
nav.querySelector('details')?.addEventListener('toggle', () => placeMarker(marker, nav.querySelector('a[aria-current="page"]'), { instant: true }));
window.addEventListener('resize', () => placeMarker(marker, nav.querySelector('a[aria-current="page"]'), { instant: true }), { passive: true });

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  if (signInReturn && !hasSignInError) {
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
    unreachable(error);
    return;
  }
  document.body.dataset.auth = 'in';
  const email = ctx.me.user.email || '';
  document.getElementById('cp-email').textContent = email;
  document.getElementById('cp-email').title = email;
  document.getElementById('cp-avatar').textContent = (email || 'P').slice(0, 1);
  document.getElementById('cp-plan').textContent = ctx.plan === 'cloud' ? 'Cloud plan' : 'Local · free';
  document.getElementById('cp-user').hidden = false;
  markLocked();
  const out = document.getElementById('cp-signout');
  out.hidden = false;
  out.addEventListener('click', async () => {
    await signOut();
    location.replace('/');
  });
  document.addEventListener('pigeonbox:accounts', (event) => showRouteHealth(event.detail));
  if (ctx.caps.has('cloud_mail_sync')) import('./shared.js').then(({ accounts }) => accounts()).catch(() => undefined);
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
