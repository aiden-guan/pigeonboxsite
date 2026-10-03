import { signOut } from '../../lib/session.js';
import { button, card, chips, confirmDialog, day, facts, h, humanize, note, plural } from '../ui.js';

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

  const subscription = card(
    'Plan',
    landing.checkout === 'success' ? note('Thanks. Your subscription shows here as soon as Stripe confirms it.', 'success') : null,
    landing.checkout === 'cancel' ? note('Checkout was canceled. Nothing was charged.', 'info') : null,
    facts([
      ['Account', me.user.email || me.user.id],
      ['Plan', isCloud ? 'PigeonBox Cloud' : 'Free (Local only)'],
      ['Subscription', STATUS_TEXT[me.subscription.status] || humanize(me.subscription.status)],
      ['Renews', me.subscription.currentPeriodEnd ? day(me.subscription.currentPeriodEnd) : '—'],
    ]),
    !isCloud && !price ? h('p', { class: 'hint' }, 'Cloud subscriptions are not open yet.') : null,
    h('div', { class: 'row' },
      !isCloud && price ? button(`Subscribe · ${price}`, go('/v1/billing/checkout'), { busy: 'Opening Stripe…' }) : null,
      me.subscription.status !== 'none' ? button('Manage billing', go('/v1/billing/portal'), { variant: isCloud ? 'primary' : 'ghost', busy: 'Opening Stripe…' }) : null,
    ),
  );

  const included = card(
    'Usage',
    h('p', {}, `${plural(usage.aiRequestsToday, 'request')} today · ${usage.aiTokensThisMonth.toLocaleString()} tokens this month.`),
    chips(entitlements.capabilities.length ? entitlements.capabilities : ['none']),
  );

  const danger = card(
    'Delete account',
    h('p', {}, 'Deletes your PigeonBox Cloud account, hosted tracking data and usage records, and cancels your subscription. Local PigeonBox data in your browser is not affected.'),
    h('div', { class: 'row' }, button('Delete account…', async () => {
      const phrase = 'delete my account';
      const ok = await confirmDialog({ title: 'Delete your PigeonBox Cloud account?', body: 'This cannot be undone.', confirm: 'Delete account', danger: true, typed: phrase });
      if (!ok) return;
      await api('/v1/account/delete', { method: 'POST', body: { confirm: phrase } });
      await signOut();
      location.replace('/?deleted=1');
    }, { variant: 'danger-ghost', busy: 'Deleting…' })),
  );

  return h('div', { class: 'stack' }, subscription, included, danger);
}
