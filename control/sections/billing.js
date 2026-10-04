import { signOut } from '../../lib/session.js';
import { button, confirmDialog, day, eyebrow, h, humanize, manifest, note, notice, pill, stamp, surface, tag, usageMeter } from '../ui.js';
import { celebrate } from '../motion.js';

const STATUS_TEXT = {
  none: 'No subscription',
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Payment due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  unpaid: 'Unpaid',
  paused: 'Paused',
};
const STATUS_TONE = { active: 'good', trialing: 'info', past_due: 'bad', unpaid: 'bad', incomplete: 'warn', paused: 'neutral' };
const SERVICES = {
  cloud_ai: 'Hosted AI',
  cloud_mail_sync: 'Always-on mail sync',
  cloud_auto_drafts: 'Background drafts',
  cloud_automations: 'Automations & Smart Views',
  cloud_sequences: 'Sequences',
  cloud_relationships: 'Relationships',
  cloud_tracking: 'Hosted tracking',
  cloud_documents: 'Tracked documents',
  cloud_team: 'Team workspaces',
  cloud_mcp: 'API & MCP',
  cloud_semantic_search: 'Semantic search',
  cloud_ask_inbox: 'Ask your inbox',
  cloud_calendar: 'Calendar',
};
const PAYMENT_TROUBLE = new Set(['past_due', 'unpaid', 'incomplete']);

function formatPrice(price) {
  if (!price?.available || !Number.isInteger(price.unitAmount) || !price.currency || !price.interval) return null;
  const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency.toUpperCase(), maximumFractionDigits: price.unitAmount % 100 === 0 ? 0 : 2 }).format(price.unitAmount / 100);
  return `${amount} / ${price.interval}`;
}

/** Plan, subscription and usage. Stripe hosts checkout and the billing portal. */
export async function render({ api, landing }) {
  const [me, entitlements, pricing] = await Promise.all([
    api('/v1/me'),
    api('/v1/account/entitlements'),
    api('/v1/public/pricing').catch(() => ({ available: false })),
  ]);
  const isCloud = me.plan === 'cloud';
  const price = formatPrice(pricing);
  const go = (path) => async () => {
    const { url } = await api(path, { method: 'POST', body: {} });
    location.assign(url);
  };
  const usage = entitlements.usage;
  const limits = entitlements.limits;
  const status = me.subscription.status;
  const checkout = landing.checkout;
  delete landing.checkout;

  const manage = status !== 'none' ? button('Manage billing', go('/v1/billing/portal'), { variant: isCloud ? 'primary' : 'ghost', busy: 'Opening Stripe…' }) : null;
  const receipt = surface(
    'card',
    { className: 'receipt' },
    eyebrow('Plan'),
    h('p', { class: 'receipt-plan' }, isCloud ? 'PigeonBox Cloud' : 'Local'),
    h('p', { class: 'receipt-price' }, isCloud ? (price ?? 'Subscription') : 'Free · runs in your browser'),
    isCloud && status === 'active' ? stamp('Cloud', 'Active') : null,
    manifest([
      ['Account', me.user.email || me.user.id],
      ['Plan', isCloud ? 'PigeonBox Cloud' : 'Free (Local only)'],
      ['Subscription', pill(STATUS_TEXT[status] || humanize(status), STATUS_TONE[status] ?? 'neutral')],
      ['Renews', me.subscription.currentPeriodEnd ? `${day(me.subscription.currentPeriodEnd)}${me.subscription.cancelAtPeriodEnd ? ' · ends then' : ''}` : '—'],
      ['Payments', 'Handled by Stripe'],
    ]),
    !isCloud && !price ? h('p', { class: 'hint' }, 'Cloud subscriptions are not open yet.') : null,
    h('div', { class: 'row' }, !isCloud && price ? button(`Subscribe · ${price}`, go('/v1/billing/checkout'), { busy: 'Opening Stripe…' }) : null, manage),
  );
  if (checkout === 'success') setTimeout(() => celebrate(receipt, { state: 'stars', text: 'Cloud', small: 'Welcome' }), 500);

  const services = entitlements.capabilities.length
    ? h('ul', { class: 'services' }, entitlements.capabilities.map((capability) => h('li', {}, SERVICES[capability] ?? humanize(capability).replace(/^cloud /, '').replace(/^./, (c) => c.toUpperCase()))))
    : h('p', { class: 'muted' }, 'No Cloud services on this plan. PigeonBox on your computer keeps working.');

  const usageBar = isCloud ? usageMeter(usage, limits) : null;
  const ledgerSide = h(
    'div',
    { class: 'stack' },
    usageBar ? surface('ledger', { title: 'Usage' }, usageBar) : null,
    surface('ledger', { title: 'Included services', actions: tag(`${entitlements.capabilities.length} on`, entitlements.capabilities.length ? 'copper' : null) }, services),
  );

  const danger = surface(
    'card',
    { eyebrow: 'Cannot be undone', title: 'Delete account', className: 'danger-zone' },
    h('p', { class: 'muted' }, 'Deletes your PigeonBox Cloud account, hosted tracking data and usage records, and cancels your subscription. Local PigeonBox data in your browser is not affected.'),
    h(
      'div',
      { class: 'row' },
      button('Delete account…', async () => {
        const phrase = 'delete my account';
        const ok = await confirmDialog({ title: 'Delete your PigeonBox Cloud account?', body: 'This cannot be undone.', confirm: 'Delete account', danger: true, typed: phrase });
        if (!ok) return;
        await api('/v1/account/delete', { method: 'POST', body: { confirm: phrase } });
        await signOut();
        location.replace('/?deleted=1');
      }, { variant: 'danger-ghost', busy: 'Deleting…' }),
    ),
  );

  return [
    checkout === 'success' ? note('Thanks. Your subscription shows here as soon as Stripe confirms it.', 'success') : null,
    checkout === 'cancel' ? note('Checkout was canceled. Nothing was charged.', 'info') : null,
    PAYMENT_TROUBLE.has(status)
      ? notice({ tone: 'bad', label: 'Payment', title: STATUS_TEXT[status], text: 'Stripe could not complete a payment. Update your payment method to keep Cloud running.', actions: manage ? [button('Fix payment', go('/v1/billing/portal'), { busy: 'Opening Stripe…' })] : [] })
      : null,
    h('div', { class: 'ledger-layout' }, receipt, ledgerSide),
    danger,
  ];
}
