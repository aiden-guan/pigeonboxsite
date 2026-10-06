import { API_BASE, linkRedirectUri, startLink, startSignIn } from '../../lib/session.js';
import { STORE_URL } from '../../lib/extension.js';
import { arrowLink, button, checkbox, h, link, note, notice, pill, surface } from '../ui.js';
import { clearIntent, readIntent, writeIntent } from '../setup-intent.js';

const SIGNED_IN = new Set(['ready', 'not_entitled', 'unreachable']);
const LINK_TRIED_KEY = 'pigeonbox.linkTried';

/** Avoid sending someone round the sign-in loop twice in a row if connecting keeps failing. */
function mayAutoLink() {
  try {
    const last = Number(sessionStorage.getItem(LINK_TRIED_KEY) || 0);
    if (Date.now() - last < 120_000) return false;
    sessionStorage.setItem(LINK_TRIED_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

const apiOrigin = () => API_BASE || location.origin;
const sameEmail = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Switching to Cloud, one step at a time: agree, sign in, connect PigeonBox in
 * this browser, subscribe, switch. Each trip away (sign-in, Stripe) comes back
 * here and setup continues on its own; nothing switches without the agreement.
 */
export async function render(ctx) {
  const { api, ext, extension, me, landing } = ctx;
  const status = h('p', { class: 'hint', attrs: { role: 'status' } });

  if (!extension) {
    return surface(
      'card',
      { eyebrow: 'First', title: 'Install PigeonBox in Chrome' },
      h('p', { class: 'muted' }, 'Cloud works through the PigeonBox extension in Gmail. Install it, then open Settings from PigeonBox to finish switching to Cloud.'),
      h('div', { class: 'row' }, arrowLink('Get PigeonBox for Chrome', STORE_URL, { target: '_blank', rel: 'noopener' })),
      me ? h('p', { class: 'hint' }, `Signed in as ${me.user.email}. Your account and subscription are in Billing.`) : null,
    );
  }

  let product = extension.product;
  if (!product.cloudAvailable) {
    return notice({
      tone: 'warn',
      label: 'Update needed',
      title: 'This version of PigeonBox doesn’t include Cloud',
      text: 'Update PigeonBox from the Chrome Web Store (or click Update on chrome://extensions), then open Settings from PigeonBox again.',
      actions: [arrowLink('Open in the Chrome Web Store', STORE_URL, { target: '_blank', rel: 'noopener' })],
    });
  }
  if (extension.apiBaseUrl && new URL(extension.apiBaseUrl).origin !== apiOrigin()) {
    return notice({
      tone: 'bad',
      label: 'Different server',
      title: 'PigeonBox in this browser uses another Cloud server',
      text: `This dashboard talks to ${apiOrigin()}, but PigeonBox is set up for ${new URL(extension.apiBaseUrl).origin}. Open Settings from PigeonBox to reach its own dashboard.`,
    });
  }

  let intent = readIntent();
  const consented = Boolean(intent) || product.runMode === 'cloud';
  const linked = SIGNED_IN.has(product.cloud.status) && (!me || !product.cloud.email || sameEmail(product.cloud.email, me.user.email));
  const otherAccount = SIGNED_IN.has(product.cloud.status) && me && product.cloud.email && !sameEmail(product.cloud.email, me.user.email);
  let entitled = ctx.plan === 'cloud' || product.cloud.status === 'ready';
  const switched = product.runMode === 'cloud';

  const connect = async () => {
    const begin = await ext('LINK_BEGIN', { redirectUri: linkRedirectUri() });
    startLink(begin, '#cloud');
    await new Promise(() => undefined); // The page is leaving.
  };
  const finishSwitch = async () => {
    // The extension caches what the account may use; make sure it has seen the subscription.
    await ext('REFRESH').catch(() => undefined);
    const switchedTo = await ext('SET_RUN_MODE', { mode: 'cloud', consent: true });
    clearIntent();
    // Hosted tracking needs Chrome access to Cloud's addresses; the extension asks in its own window.
    const origins = switchedTo.product?.cloudOrigins ?? product.cloudOrigins ?? [];
    if (origins.length) await ext('GRANT', { origins }).catch(() => undefined);
    ctx.toast('PigeonBox now runs on Cloud.', 'success');
    history.replaceState(null, '', ctx.caps.has('cloud_mail_sync') ? '#connections' : '#overview');
    await ctx.reload();
  };

  // Continue on our own after each trip, but only with the person's agreement.
  if (intent && me && !linked && !otherAccount && mayAutoLink()) {
    status.textContent = 'Connecting PigeonBox in this browser…';
    void connect().catch((error) => (status.textContent = error.message));
  }
  if (linked && landing.checkout === 'success') {
    delete landing.checkout;
    // Stripe tells Cloud a moment after it sends the person back, so ask again for a little while.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const reply = await ext('REFRESH').catch(() => null);
      if (reply?.product) product = reply.product;
      entitled = product.cloud.status === 'ready';
      if (entitled || !intent) break;
      await wait(2_500);
    }
  }
  if (intent && linked && entitled && !switched) {
    await finishSwitch();
    return h('p', { class: 'muted' }, 'Switching to Cloud…');
  }

  if (switched && linked && entitled) {
    return [
      surface(
        'card',
        { eyebrow: 'Mode', title: 'PigeonBox runs on Cloud', meta: product.cloud.email ? `Connected as ${product.cloud.email}` : null },
        h('p', { class: 'muted' }, 'Cloud keeps working while Gmail is closed. Connect Google so it can sync your mail and calendar.'),
        h('div', { class: 'row' }, link('Connected accounts', '#connections', { class: 'btn btn-primary' }), link('Overview', '#overview', { class: 'btn btn-ghost' })),
      ),
    ];
  }

  // The steps, in order. The first unfinished one carries the action.
  const agree = checkbox('I understand that email content is sent to PigeonBox Cloud for processing.', consented);
  const steps = [
    {
      title: 'Agree to Cloud processing',
      done: consented,
      body: () => [
        h('p', { class: 'muted' }, 'When PigeonBox summarizes, sorts, drafts or answers a question, the email content involved is sent over an encrypted connection to PigeonBox Cloud and its AI provider. Cloud stores encrypted summaries, prepared drafts and related intelligence. Keeping message excerpts is a separate opt-in. Your local index and settings stay on this computer.'),
        agree,
        h('div', { class: 'row' }, button('Continue', async () => {
          if (!agree.querySelector('input').checked) throw new Error('Tick the box to agree first.');
          writeIntent();
          intent = readIntent();
          await ctx.rerender();
        })),
      ],
    },
    {
      title: 'Sign in',
      done: Boolean(me),
      body: () => [
        h('p', { class: 'muted' }, 'Sign in with the Google account from your Cloud beta invitation.'),
        h('div', { class: 'row' }, button('Sign in with Google', () => startSignIn(status, '#cloud'), { busy: 'Opening sign-in…' })),
      ],
    },
    {
      title: 'Connect PigeonBox in this browser',
      done: linked,
      body: () => [
        otherAccount
          ? note(`PigeonBox here is signed in as ${product.cloud.email}, but this dashboard is signed in as ${me.user.email}. Connect it again to use one account.`, 'warn')
          : h('p', { class: 'muted' }, 'PigeonBox gets its own sign-in through this page. Google may ask you to choose the account again.'),
        h('div', { class: 'row' }, button(otherAccount ? 'Connect as this account' : 'Connect PigeonBox', connect, { busy: 'Opening sign-in…' })),
      ],
    },
    {
      title: 'Subscribe',
      done: entitled,
      body: () => [
        h('p', { class: 'muted' }, 'Cloud is invite-only during the beta. Enter the code from your invitation at checkout; with a beta code no card is needed.'),
        h('div', { class: 'row' }, button('Subscribe', async () => {
          const { url } = await api('/v1/billing/checkout', { method: 'POST', body: {} });
          location.assign(url);
          await new Promise(() => undefined);
        }, { busy: 'Opening Stripe…' }), link('Billing details', '#billing', { class: 'btn btn-ghost' })),
        landing.checkout === 'success' ? note('Stripe is still confirming your subscription. This updates in a moment; reload if it does not.', 'info') : null,
      ],
    },
    {
      title: 'Switch PigeonBox to Cloud',
      done: switched,
      body: () => [
        h('p', { class: 'muted' }, 'PigeonBox in this browser starts using Cloud. Connect Google next so Cloud can work while Gmail is closed.'),
        h('div', { class: 'row' }, button('Start using Cloud', finishSwitch, { busy: 'Switching…' })),
      ],
    },
  ];
  const current = steps.findIndex((step) => !step.done);

  return [
    switched && !entitled ? notice({ tone: 'warn', label: 'Cloud mode', title: 'PigeonBox is set to Cloud but the subscription is not active', text: 'Until it is, PigeonBox sorts with on-device rules and sends nothing to an AI provider. Subscribe below or switch back to Local.' }) : null,
    h(
      'ol',
      { class: 'setup-steps' },
      steps.map((step, index) =>
        h(
          'li',
          { class: ['setup-step', step.done ? 'is-done' : index === current ? 'is-current' : 'is-later'], attrs: { 'aria-current': index === current ? 'step' : null } },
          h('div', { class: 'setup-step-head' }, h('span', { class: 'setup-step-n', attrs: { 'aria-hidden': 'true' } }, String(index + 1).padStart(2, '0')), h('h2', {}, step.title), step.done ? pill('Done', 'good') : null),
          index === current ? h('div', { class: 'setup-step-body' }, step.body()) : null,
        ),
      ),
    ),
    status,
    h('p', { class: 'hint' }, 'Changed your mind? PigeonBox keeps running on this computer until the last step.'),
  ];
}
