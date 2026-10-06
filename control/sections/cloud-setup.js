import { API_BASE, linkRedirectUri, restoreExtensionAccount, startSignIn } from '../../lib/session.js';
import { STORE_URL } from '../../lib/extension.js';
import { arrowLink, button, checkbox, h, link, note, notice, pill, surface } from '../ui.js';
import { clearIntent, readIntent, writeIntent } from '../setup-intent.js';

const SIGNED_IN = new Set(['ready', 'not_entitled', 'unreachable']);
const apiOrigin = () => API_BASE || location.origin;
const sameEmail = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One PigeonBox account sign-in, explicit processing consent, then Gmail access.
 * The installed extension receives its own PKCE-bound session without another login.
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

  if (ctx.accountError) return notice({
    tone: 'warn', label: 'Try again', title: 'Your PigeonBox account could not be loaded',
    text: 'Your sign-in is saved. Check your connection and retry to load your Cloud subscription.',
    actions: [button('Retry account connection', () => ctx.reload())],
  });

  const intent = readIntent();
  const consented = product.runMode === 'cloud' || Boolean(me && intent?.userId === me.user.id);
  const matchingAccount = me && (extension.account ? extension.account.id === me.user.id : sameEmail(product.cloud.email, me.user.email));
  const linked = SIGNED_IN.has(product.cloud.status) && matchingAccount;
  const otherAccount = SIGNED_IN.has(product.cloud.status) && me && product.cloud.email && !matchingAccount;
  const entitled = Boolean(me && ctx.plan === 'cloud');
  const switched = product.runMode === 'cloud';

  const allowCloud = async () => {
    const origins = product.cloudOrigins ?? [];
    if (!origins.length || (await ext('CHECK_ORIGINS', { origins })).granted) return;
    const grant = await ext('GRANT', { origins });
    if (grant.granted) return;
    status.textContent = 'Click Allow in the PigeonBox window so this browser can reach Cloud.';
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await wait(1_000);
      if ((await ext('CHECK_ORIGINS', { origins })).granted) return;
    }
    throw new Error('Cloud access was not allowed. Click Start using Cloud to try again.');
  };
  const finishSwitch = async () => {
    if (!me || !entitled) throw new Error('Sign in to your subscribed PigeonBox account first.');
    if (!agree.querySelector('input').checked) throw new Error('Tick the box to agree first.');
    writeIntent(me.user.id);
    await allowCloud();
    if (!linked) {
      status.textContent = 'Setting up Cloud with your PigeonBox account…';
      const begin = await ext('LINK_BEGIN', { redirectUri: linkRedirectUri() });
      const reply = await api('/v1/auth/link', { method: 'POST', body: {
        redirect_uri: linkRedirectUri(), code_challenge: begin.codeChallenge,
        code_challenge_method: 'S256', state: begin.state,
      } });
      if (reply.state !== begin.state) throw new Error('Your account connection could not be verified. Try again.');
      const connected = await ext('LINK_COMPLETE', { code: reply.code, state: reply.state });
      if (connected.user?.id !== me.user.id) throw new Error('PigeonBox connected a different account. Try again.');
      product = connected.product ?? product;
    }
    const refreshed = await ext('REFRESH');
    product = refreshed.product ?? product;
    if (product.cloud.status !== 'ready') throw new Error(product.cloud.status === 'unreachable'
      ? 'This browser could not reach Cloud. Check your connection and try again.'
      : 'Your Cloud subscription is still being confirmed. Try again in a moment.');
    await ext('SET_RUN_MODE', { mode: 'cloud', consent: true });
    clearIntent();
    status.textContent = '';
    ctx.toast('PigeonBox now runs on Cloud.', 'success');
    history.replaceState(null, '', ctx.caps.has('cloud_mail_sync') ? '#connections' : '#overview');
    await ctx.reload();
  };
  const agree = checkbox('I understand that email content is sent to PigeonBox Cloud for processing.', consented);

  if (switched && linked && entitled) {
    return surface(
      'card',
      { eyebrow: 'Mode', title: 'PigeonBox runs on Cloud', meta: `PigeonBox account: ${me.user.email}` },
      h('p', { class: 'muted' }, 'Connect the Gmail account you want Cloud to work with. It can be different from your PigeonBox account.'),
      h('div', { class: 'row' }, link('Set up your email', '#connections', { class: 'btn btn-primary' }), link('Overview', '#overview', { class: 'btn btn-ghost' })),
    );
  }

  const steps = [
    {
      title: 'Your PigeonBox account',
      done: Boolean(me && entitled),
      summary: me ? `${me.user.email}${entitled ? ' · Cloud subscription active' : ''}` : null,
      body: () => !me ? [
        h('p', { class: 'muted' }, 'Sign in with the account you used to subscribe to PigeonBox Cloud. You’ll choose which Gmail account Cloud works with separately.'),
        h('div', { class: 'row' }, button('Sign in with Google', () => startSignIn(status, '#cloud'), { busy: 'Opening sign-in…' })),
      ] : [
        h('p', { class: 'muted' }, `Signed in as ${me.user.email}. This account does not have an active Cloud subscription yet.`),
        extension.accountLink && extension.account && extension.account.id !== me.user.id && product.cloud.status === 'ready' ? [
          note(`PigeonBox in this browser already has an active Cloud account: ${extension.account.email}.`, 'info'),
          button('Use your signed-in PigeonBox account', async () => {
            await restoreExtensionAccount(extension, ext, { replace: true });
            await ctx.reload();
          }),
        ] : null,
        h('p', { class: 'muted' }, 'Already subscribed? Switch to the PigeonBox account you used at checkout. Otherwise, subscribe with your beta invitation code; no card is needed with a beta code.'),
        h('div', { class: 'row' }, button('Subscribe', async () => {
          const { url } = await api('/v1/billing/checkout', { method: 'POST', body: {} });
          location.assign(url);
        }, { busy: 'Opening Stripe…' }), button('Use another account', () => startSignIn(status, '#cloud'), { variant: 'ghost' })),
        landing.checkout === 'success' ? note('Stripe is confirming your subscription. Click Check subscription in a moment.', 'info') : null,
        landing.checkout === 'success' ? button('Check subscription', () => ctx.reload(), { variant: 'ghost' }) : null,
      ],
    },
    {
      title: 'Start using Cloud',
      done: switched && linked && entitled,
      body: () => [
        otherAccount ? note(`This browser was connected to ${product.cloud.email}. Starting Cloud will use your PigeonBox account ${me.user.email}.`, 'warn') : null,
        h('p', { class: 'muted' }, 'Email content used for summaries, sorting, drafts and answers is sent over an encrypted connection to PigeonBox Cloud and its AI provider. Cloud stores encrypted summaries, prepared drafts and related intelligence. Keeping message excerpts is a separate opt-in.'),
        agree,
        h('div', { class: 'row' }, button('Start using Cloud', finishSwitch, { busy: 'Setting up Cloud…' })),
        status,
      ],
    },
    {
      title: 'Connect your email',
      done: false,
      summary: 'Choose the Gmail account Cloud should work with. It can be different from your PigeonBox account.',
      body: () => [],
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  return [
    h('ol', { class: 'setup-steps' }, steps.map((step, index) => h(
      'li',
      { class: ['setup-step', step.done ? 'is-done' : index === current ? 'is-current' : 'is-later'], attrs: { 'aria-current': index === current ? 'step' : null } },
      h('div', { class: 'setup-step-head' }, h('span', { class: 'setup-step-n', attrs: { 'aria-hidden': 'true' } }, String(index + 1).padStart(2, '0')), h('h2', {}, step.title), step.done ? pill('Done', 'good') : null),
      step.summary ? h('p', { class: 'hint setup-step-summary' }, step.summary) : null,
      index === current ? h('div', { class: 'setup-step-body' }, step.body()) : null,
    ))),
    current === 0 ? status : null,
    h('p', { class: 'hint' }, 'PigeonBox keeps running on this computer until you start Cloud.'),
  ];
}
