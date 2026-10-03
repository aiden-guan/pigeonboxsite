import { ago, arrowLink, day, dispatchStatus, empty, h, humanize, index, link, meter, notice, pill, plural, routeStrip, stat, surface, timeline } from '../ui.js';
import { accounts, phasePill, routeHealth, syncPhase } from '../shared.js';

const SUBSCRIPTION = { none: ['No subscription', 'neutral'], active: ['Active', 'good'], trialing: ['Trial', 'info'], past_due: ['Payment due', 'bad'], canceled: ['Canceled', 'neutral'], incomplete: ['Incomplete', 'warn'], incomplete_expired: ['Expired', 'neutral'], unpaid: ['Unpaid', 'bad'], paused: ['Paused', 'neutral'] };
const DESK = [
  ['NEEDS_REPLY', 'Needs reply'],
  ['WAITING_ON_ME', 'Waiting on me'],
  ['WAITING_ON_THEM', 'Waiting on them'],
];
const CATCHING_UP = new Set(['importing', 'recovering', 'catching_up']);

const auditTone = (event) => (event.undoneAt ? 'quiet' : event.policy.decision === 'denied' ? 'bad' : event.policy.decision === 'approval_required' ? 'warn' : event.tier >= 2 ? 'copper' : 'neutral');

/** Account operations belong here; daily work lives in the Gmail workspace. */
export async function render({ api, me, plan }) {
  const [overview, connections, entitlements, audit] = await Promise.all([
    api('/v1/control/overview'),
    accounts(true).catch(() => null),
    api('/v1/account/entitlements').catch(() => null),
    api('/v1/audit/list', { method: 'POST', body: { limit: 6 } }).catch(() => null),
  ]);
  const health = connections ? routeHealth(connections) : null;
  const live = health?.live ?? [];
  const phases = live.map((account) => syncPhase(account));
  const reviewing = live.reduce((sum, account) => sum + (account.sync.processingBacklog ?? 0), 0);
  const waiting = overview.pendingApprovals;
  const trouble = health ? health.trouble > 0 : !overview.syncHealthy;

  // Masthead status: route health first, then what is waiting. Nothing here is invented.
  const detail = [waiting ? `${plural(waiting, 'approval')} waiting` : null, health?.lastSync ? `last sync ${ago(health.lastSync)}` : null].filter(Boolean).join(' · ');
  const status = trouble
    ? dispatchStatus({ tone: health?.tone === 'warn' ? 'warn' : 'bad', label: 'Dispatch status', phrase: health?.phrase ?? 'A connection needs attention', detail: detail || 'Review it in Connected accounts.', state: 'alert' })
    : !live.length
      ? dispatchStatus({ tone: 'neutral', label: 'Dispatch status', phrase: health ? 'No mail routes yet' : 'Routes not checked', detail: health ? 'Connect a Google account to begin.' : 'Connected accounts could not be loaded.', state: 'map' })
      : dispatchStatus({ tone: health.tone, label: 'Dispatch status', phrase: health.phrase, detail, state: health.moving ? 'route' : health.paused === live.length ? 'sleep' : 'idle' });
  const art = h('canvas', {
    class: 'ov-art',
    dataset: { scene: 'dispatch', tone: trouble ? 'attention' : !live.length || health?.paused === live.length ? 'quiet' : 'clear', stops: '4' },
    attrs: { 'aria-hidden': 'true' },
  });

  // Attention: one postal notice per account that needs a person.
  const notices = live
    .filter((account) => ['needs_reauth', 'stalled'].includes(syncPhase(account)))
    .slice(0, 2)
    .map((account) =>
      notice({
        tone: 'bad',
        label: syncPhase(account) === 'needs_reauth' ? 'Reconnect needed' : 'Sync stopped',
        title: account.email,
        text: syncPhase(account) === 'needs_reauth' ? 'Google stopped accepting PigeonBox’s access. Reconnect to resume.' : 'Syncing stopped. Review the account to resume.',
        actions: [link('Connected accounts', '#connections', { class: 'btn btn-primary btn-small' })],
      }),
    );
  if (!health && !overview.syncHealthy) notices.push(notice({ tone: 'warn', label: 'Attention', title: 'A connection needs attention.', text: 'Review its permissions or reconnect to keep mail current.', actions: [link('Connected accounts', '#connections', { class: 'btn btn-ghost btn-small' })] }));

  // Route strip: the Cloud pipeline as it stands.
  const syncStop = !live.length
    ? { value: '—', state: 'idle', detail: 'Starts after you connect' }
    : trouble
      ? { value: 'Needs attention', state: 'bad', detail: health?.phrase }
      : phases.some((phase) => CATCHING_UP.has(phase))
        ? { value: 'Catching up', state: 'active', detail: health?.lastSync ? `Last sync ${ago(health.lastSync)}` : 'First sync running' }
        : health?.paused === live.length
          ? { value: 'Paused', state: 'warn', detail: 'Nothing new is read' }
          : { value: 'Up to date', state: 'done', detail: health?.lastSync ? `Last sync ${ago(health.lastSync)}` : null };
  const strip = routeStrip(
    [
      { label: 'Mail', value: overview.connections ? plural(overview.connections, 'account') : 'None connected', state: overview.connections ? 'done' : 'idle', detail: overview.connections ? 'Gmail, through Google' : 'Connect Google to begin', href: '#connections' },
      { label: 'Sync', ...syncStop },
      { label: 'Review', value: !live.length ? '—' : reviewing ? `Reviewing ${reviewing.toLocaleString()}` : 'Current', state: !live.length ? 'idle' : reviewing ? 'active' : 'done', detail: `${plural(overview.usage.backgroundToday, 'background request')} today` },
      { label: 'Your say', value: waiting ? `${waiting.toLocaleString()} waiting` : 'Nothing waiting', state: waiting ? 'active' : live.length ? 'done' : 'idle', detail: `${plural(overview.draftsReady, 'draft')} ready · ${plural(overview.followUpsDue, 'follow-up')} due`, href: '#approvals' },
    ],
    { label: 'Cloud route' },
  );

  // Snapshot.
  const accountList = connections?.accounts.length
    ? h(
        'div',
        {},
        connections.accounts.slice(0, 5).map((account) =>
          h(
            'a',
            { class: 'ov-account', href: '#connections' },
            h('strong', { title: account.email }, account.email),
            h('span', { class: 'muted' }, [account.sync.lastSyncAt ? `Synced ${ago(account.sync.lastSyncAt)}` : 'Not synced yet', plural(account.sync.threadsTracked, 'thread')].join(' · ')),
            phasePill(account),
          ),
        ),
        connections.accounts.length > 5 ? h('p', { class: 'hint' }, `And ${plural(connections.accounts.length - 5, 'more account')}.`) : null,
      )
    : connections
      ? empty('No Google account is connected.', link('Connect Google', '#connections', { class: 'btn btn-primary btn-small' }))
      : h('p', { class: 'muted' }, `${plural(overview.connections, 'account')} connected. Details are in Connected accounts.`);

  const approvals = surface(
    'parcel',
    { eyebrow: 'Approvals', title: 'Waiting for your say', className: ['ov-approvals', !waiting && 'is-quiet'].filter(Boolean).join(' ') },
    h(
      'div',
      { class: 'ov-approvals-body' },
      h('p', { class: 'ov-big', attrs: { 'aria-hidden': 'true' } }, String(waiting)),
      h('p', { class: 'muted' }, waiting ? `${plural(waiting, 'item')} ${waiting === 1 ? 'needs' : 'need'} your decision before anything is sent or scheduled.` : 'Nothing is waiting. Sends and invitations always stop here first.'),
      h('div', { class: 'row' }, link(waiting ? 'Review' : 'Open Approvals', '#approvals', { class: ['btn', waiting ? 'btn-primary' : 'btn-ghost', 'btn-small'], attrs: waiting ? { 'aria-label': `Review ${plural(waiting, 'approval')}` } : {} })),
    ),
  );

  const deskStats = [
    ...DESK.filter(([state]) => overview.focus[state] !== undefined).map(([state, label]) => stat(label, overview.focus[state].toLocaleString())),
    stat('Follow-ups due', overview.followUpsDue.toLocaleString()),
    stat('Drafts ready', overview.draftsReady.toLocaleString()),
  ].slice(0, 6);

  const sub = SUBSCRIPTION[me.subscription.status] ?? [humanize(me.subscription.status), 'neutral'];
  const usage = entitlements?.usage ?? { aiRequestsToday: overview.usage.backgroundToday, aiTokensThisMonth: overview.usage.tokensThisMonth };
  const limits = entitlements?.limits ?? {};
  const planCard = surface(
    'stub',
    { className: 'ov-plan' },
    h('div', { class: 'split' }, h('p', { class: 'eyebrow' }, 'Plan'), pill(...sub)),
    h('h2', { class: 'ov-plan-name' }, plan === 'cloud' ? 'PigeonBox Cloud' : 'Local · free'),
    h('p', { class: 'muted' }, me.subscription.currentPeriodEnd ? `${me.subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${day(me.subscription.currentPeriodEnd)}` : plan === 'cloud' ? 'No renewal date on file.' : 'PigeonBox on your computer is free.'),
    meter('AI requests today', usage.aiRequestsToday, limits.aiRequestsPerDay ?? null),
    meter('Tokens this month', usage.aiTokensThisMonth, limits.aiTokensPerMonth ?? null),
    h('div', { class: 'row' }, arrowLink('Billing & subscription', '#billing')),
  );

  const activity = surface(
    'ledger',
    { title: 'Recent activity', actions: arrowLink('Dispatch log', '#activity'), className: 'ov-activity' },
    audit
      ? audit.events.length
        ? timeline(
            audit.events.map((event) => ({ at: event.at, title: event.summary, meta: `${event.actor.name} · ${event.policy.reason}`, tone: auditTone(event), aside: event.undoneAt ? pill('Undone', 'neutral') : null })),
            { days: false },
          )
        : empty('Nothing has been done on your behalf yet. Every change PigeonBox makes appears here, with who asked for it and why.')
      : h('p', { class: 'muted' }, 'Activity could not be loaded right now.'),
  );

  const controls = surface(
    'ledger',
    { title: 'Quick routes', className: 'ov-controls' },
    index([
      ['Connected accounts', 'Permissions, sync and reconnects', '#connections'],
      ['Privacy & data', 'Retention, learning and deletion', '#privacy'],
      ['Billing & subscription', 'Plan, payment and usage', '#billing'],
      ['Team', 'Workspaces and shared threads', '#team'],
      ['API & MCP', 'Tokens and webhooks', '#developers'],
    ]),
  );

  const content = [
    notices.length ? h('div', { class: 'stack' }, notices) : null,
    surface('card', { eyebrow: 'Cloud route', title: 'How your mail is moving', className: 'ov-route' }, strip),
    h(
      'div',
      { class: 'ov-grid' },
      surface('card', { eyebrow: 'Connected accounts', title: 'Mail routes', actions: arrowLink('Manage', '#connections'), className: 'ov-accounts' }, accountList),
      h(
        'div',
        { class: 'ov-side' },
        approvals,
        overview.latestBriefing ? surface('slip', { title: 'Latest briefing', href: '#briefings' }, h('p', {}, h('strong', {}, overview.latestBriefing.title)), h('p', { class: 'muted' }, `Prepared ${ago(overview.latestBriefing.generatedAt)}`)) : null,
      ),
      surface('ledger', { title: 'On your desk', className: 'ov-desk' }, h('div', { class: 'stats' }, deskStats), h('p', { class: 'hint' }, 'Use the PigeonBox workspace in Gmail for replies, follow-ups, Ask and tasks. Manage your account and data here.')),
      planCard,
      activity,
      controls,
    ),
  ];
  return { content, aside: status, art, className: 'ov-masthead' };
}
