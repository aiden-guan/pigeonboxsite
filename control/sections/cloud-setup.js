import { API_BASE, linkRedirectUri, restoreExtensionAccount, startSignIn } from '../../lib/session.js';
import { STORE_URL } from '../../lib/extension.js';
import { arrowLink, button, checkbox, h, link, note, notice, pill, surface } from '../ui.js';
import { clearIntent, readIntent, writeIntent } from '../setup-intent.js';

const SIGNED_IN = new Set(['ready', 'not_entitled', 'unreachable']);
const apiOrigin = () => API_BASE || location.origin;
const sameEmail = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CONFIRM_TRIES = 20;

function formatPrice(price) {
  if (!price?.available || !Number.isInteger(price.unitAmount) || !price.currency || !price.interval) return null;
  return `${new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency.toUpperCase(), maximumFractionDigits: price.unitAmount % 100 === 0 ? 0 : 2 }).format(price.unitAmount / 100)} / ${price.interval}`;
}

/**
 * Getting Cloud is one path, always in the same order:
 * 1. sign in to a PigeonBox account, 2. subscribe, 3. install PigeonBox (only
 * when it is missing), 4. turn Cloud on in this browser, 5. connect Gmail.
 * Each step opens only when the one before it is done. Coming back from
 * sign-in or Stripe lands here, and the subscription is confirmed on its own.
 * The installed extension receives its own PKCE-bound session without another login.
 */
export async function render(ctx) {
  const { api, ext, extension, me, landing } = ctx;
  const status = h('p', { class: 'hint', attrs: { role: 'status' } });

  if (ctx.accountError) return notice({
    tone: 'warn', label: 'Try again', title: 'Your PigeonBox account could not be loaded',
    text: 'Your sign-in is saved. Check your connection and retry to load your Cloud subscription.',
    actions: [button('Retry account connection', () => ctx.reload())],
  });
  if (extension?.apiBaseUrl && new URL(extension.apiBaseUrl).origin !== apiOrigin()) {
    return notice({
      tone: 'bad',
      label: 'Different server',
      title: 'PigeonBox in this browser uses another Cloud server',
      text: `This dashboard talks to ${apiOrigin()}, but PigeonBox is set up for ${new URL(extension.apiBaseUrl).origin}. Open Settings from PigeonBox to reach its own dashboard.`,
    });
  }

  let product = extension?.product ?? null;
  const installed = Boolean(product?.cloudAvailable);
  const intent = readIntent();
  const consented = product?.runMode === 'cloud' || Boolean(me && intent?.userId === me.user.id);
  const matchingAccount = Boolean(me && product && (extension.account ? extension.account.id === me.user.id : sameEmail(product.cloud.email, me.user.email)));
  const linked = Boolean(product && SIGNED_IN.has(product.cloud.status) && matchingAccount);
  const otherAccount = Boolean(product && SIGNED_IN.has(product.cloud.status) && me && product.cloud.email && !matchingAccount);
  const entitled = Boolean(me && ctx.plan === 'cloud');
  const switched = product?.runMode === 'cloud';
  const pricing = me && !entitled ? await api('/v1/public/pricing').catch(() => ({ available: false })) : null;
  const price = formatPrice(pricing);

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
    throw new Error('Cloud access was not allowed. Click Turn on Cloud to try again.');
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

  // Stripe sends people back before its webhook lands. Wait for it here instead of asking them to check.
  const confirming = Boolean(me && !entitled && landing.checkout === 'success');
  const confirmStatus = h('p', { class: 'hint', attrs: { role: 'status' } }, confirming ? 'Confirming your subscription with Stripe…' : '');
  if (confirming) void (async () => {
    for (let attempt = 0; attempt < CONFIRM_TRIES; attempt += 1) {
      await wait(attempt < 5 ? 1_500 : 3_000);
      if (!confirmStatus.isConnected) return;
      const latest = await api('/v1/me').catch(() => null);
      if (latest?.plan === 'cloud') {
        if (extension) await ext('REFRESH').catch(() => undefined);
        ctx.toast('Your Cloud subscription is active.', 'success');
        return ctx.reload();
      }
    }
    if (confirmStatus.isConnected) {
      delete landing.checkout;
      confirmStatus.textContent = 'Stripe hasn’t confirmed your subscription yet. This page updates when you reload it.';
      confirmStatus.after(button('Check again', () => ctx.reload(), { variant: 'ghost' }));
    }
  })();

  const useExtensionAccount = extension?.accountLink && extension.account && me && extension.account.id !== me.user.id && product?.cloud.status === 'ready'
    ? [
      note(`PigeonBox in this browser is already subscribed as ${extension.account.email}.`, 'info'),
      button(`Continue as ${extension.account.email}`, async () => {
        await restoreExtensionAccount(extension, ext, { replace: true });
        await ctx.reload();
      }, { variant: 'ghost' }),
    ]
    : null;

  const steps = [
    {
      title: 'Sign in',
      done: Boolean(me),
      summary: me ? me.user.email : 'Your PigeonBox account holds your subscription. Any Google account works; Cloud can read a different Gmail later.',
      body: () => [
        h('p', { class: 'muted' }, 'Sign in with Google to create or open your PigeonBox account. If you already subscribed, use the account you subscribed with.'),
        h('div', { class: 'row' }, button('Sign in with Google', () => startSignIn(status, '#cloud'), { busy: 'Opening sign-in…' })),
        status,
      ],
    },
    {
      title: 'Subscribe',
      done: entitled,
      summary: entitled ? 'Cloud subscription active' : price ? `PigeonBox Cloud · ${price}` : null,
      body: () => confirming ? [confirmStatus] : [
        h('p', { class: 'muted' }, `Subscribe as ${me.user.email}. ${price ? `Cloud is ${price}. ` : ''}Have a beta invitation code? Enter it at checkout; no card is needed with one.`),
        useExtensionAccount,
        landing.checkout === 'cancel' ? note('Checkout was canceled. Nothing was charged.', 'info') : null,
        h('div', { class: 'row' },
          button('Subscribe', async () => {
            const { url } = await api('/v1/billing/checkout', { method: 'POST', body: {} });
            location.assign(url);
          }, { busy: 'Opening Stripe…' }),
          button('Use another account', () => startSignIn(status, '#cloud'), { variant: 'ghost' })),
        status,
      ],
    },
    ...(installed ? [] : [{
      title: product ? 'Update PigeonBox' : 'Install PigeonBox',
      done: false,
      summary: 'Cloud works through the PigeonBox extension in Gmail.',
      body: () => [
        h('p', { class: 'muted' }, product
          ? 'This version of PigeonBox doesn’t include Cloud. Update it from the Chrome Web Store (or click Update on chrome://extensions), then reload this page.'
          : 'Add PigeonBox to Chrome, then come back to this page. Your account and subscription are already saved.'),
        h('div', { class: 'row' },
          arrowLink(product ? 'Open in the Chrome Web Store' : 'Get PigeonBox for Chrome', STORE_URL, { target: '_blank', rel: 'noopener' }),
          button('I’ve installed it', () => location.reload(), { variant: 'ghost' })),
      ],
    }]),
    {
      title: 'Turn on Cloud',
      done: Boolean(installed && switched && linked && entitled),
      summary: 'PigeonBox keeps running on this computer until you turn Cloud on.',
      body: () => [
        otherAccount ? note(`This browser was connected to ${product.cloud.email}. Turning on Cloud will use your PigeonBox account ${me.user.email}.`, 'warn') : null,
        h('p', { class: 'muted' }, 'Email content used for summaries, sorting, drafts and answers is sent over an encrypted connection to PigeonBox Cloud and its AI provider. Cloud stores encrypted summaries, prepared drafts and related intelligence. Keeping message excerpts is a separate opt-in.'),
        agree,
        h('div', { class: 'row' }, button('Turn on Cloud', finishSwitch, { busy: 'Setting up Cloud…' })),
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
      step.summary && index !== current ? h('p', { class: 'hint setup-step-summary' }, step.summary) : null,
      index === current ? h('div', { class: 'setup-step-body' }, step.body()) : null,
    ))),
    me && current > 0 ? h('p', { class: 'hint' }, `Signed in as ${me.user.email}.`) : null,
  ];
}
