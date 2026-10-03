import { card, h, link, note, plural, stat } from '../ui.js';

/** Account operations belong here; daily work lives in the Gmail workspace. */
export async function render({ api }) {
  const overview = await api('/v1/control/overview');
  return h('div', { class: 'stack' },
    card('Your PigeonBox account', h('p', {}, 'Use the PigeonBox workspace in Gmail for replies, follow-ups, Ask and tasks. Manage your account and data here.'),
      h('div', { class: 'row' }, link('Billing & subscription', '#billing', { class: 'btn btn-primary' }), link('Connected accounts', '#connections', { class: 'btn btn-ghost' }))),
    overview.syncHealthy ? null : note('A connection needs attention. Review its permissions or reconnect to keep mail current.', 'warn'),
    h('div', { class: 'stats' }, stat('Connected accounts', String(overview.connections), 'Mail and calendar permissions are separate', '#connections'), stat('Sync', overview.syncHealthy ? 'Healthy' : 'Needs attention', 'Review connection details', '#connections')),
    h('div', { class: 'grid-2' }, card('Privacy & data', h('p', {}, 'Control retention, learning and the data PigeonBox stores.'), link('Privacy controls', '#privacy', { class: 'btn btn-ghost' })), card('Administration', h('div', { class: 'row' }, link('Team', '#team'), link('API & MCP', '#developers'), link('Audit history', '#activity')))),
    h('p', { class: 'hint' }, `Background AI today: ${plural(overview.usage.backgroundToday, 'request')} · ${overview.usage.tokensThisMonth.toLocaleString()} tokens this month.`));
}
