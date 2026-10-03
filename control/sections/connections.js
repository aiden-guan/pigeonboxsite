import { ago, button, card, checkbox, clear, confirmDialog, day, empty, facts, h, note, pill, plural, toast } from '../ui.js';
import { accounts, FEATURES, statusPill, syncPill } from '../shared.js';

const ORDER = ['mail_read', 'drafts', 'organize', 'calendar_read', 'calendar_write', 'send'];

const ERRORS = {
  access_denied: 'You declined on Google’s consent screen. Nothing was connected.',
  denied: 'Google did not grant access. Nothing was connected.',
  invalid_request: 'That sign-in link expired or was already used. Start again.',
  conflict: 'That Google account is already connected to another PigeonBox account.',
};

async function connect(api, features, accountId) {
  const { url } = await api('/v1/connections/google/start', { method: 'POST', body: { features, returnTo: 'web', ...(accountId ? { accountId } : {}) } });
  location.assign(url);
}

function featurePicker(selected, locked = []) {
  const boxes = ORDER.map((feature) => {
    const row = checkbox(FEATURES[feature].title, selected.includes(feature), { value: feature, disabled: locked.includes(feature) }, FEATURES[feature].detail);
    return row;
  });
  const picked = () => boxes.map((row) => row.querySelector('input')).filter((box) => box.checked).map((box) => box.value);
  return { el: h('div', { class: 'checks' }, boxes), picked };
}

function health(account) {
  const sync = account.sync;
  const rows = [
    ['Sync', syncPill(sync.state)],
    ['Last sync', sync.lastSyncAt ? ago(sync.lastSyncAt) : 'Not yet'],
    ['Last Gmail push', sync.lastPushAt ? ago(sync.lastPushAt) : 'None yet'],
    ['Watch renews', sync.watchExpiresAt ? ago(sync.watchExpiresAt) : '—'],
    ['Synced since', sync.coverageSince ? day(sync.coverageSince) : '—'],
    ['Threads', sync.threadsTracked.toLocaleString()],
    ['Queued work', sync.backlog ? plural(sync.backlog, 'job') : 'None'],
  ];
  return facts(rows);
}

function accountCard(account, api, redraw) {
  const missing = ORDER.filter((feature) => !account.features.includes(feature));
  const add = featurePicker(account.features, account.features);
  const problem =
    account.status === 'needs_reauth'
      ? note('Google stopped accepting PigeonBox’s access (the password changed or access was removed). Reconnect to resume.', 'error')
      : account.sync.lastErrorCode && account.sync.state !== 'healthy'
        ? note(`Last problem: ${account.sync.lastErrorCode.replace(/_/g, ' ')}. PigeonBox retries automatically.`, 'warn')
        : null;

  return h(
    'article',
    { class: 'card' },
    h('header', { class: 'approval-head' }, h('div', {}, h('h2', {}, account.email), h('p', { class: 'muted' }, `Connected ${ago(account.connectedAt)}`)), statusPill(account.status)),
    problem,
    health(account),
    h('h3', {}, 'Permissions'),
    h('div', { class: 'chips' }, account.features.map((feature) => pill(FEATURES[feature]?.title ?? feature, 'good'))),
    missing.length
      ? h(
          'details',
          { class: 'disclosure' },
          h('summary', {}, 'Add permissions'),
          h('p', { class: 'hint' }, 'Google asks you to approve only what is new. Existing permissions stay as they are.'),
          add.el,
          h('div', { class: 'row' }, button('Continue to Google', () => {
            const picked = add.picked().filter((feature) => !account.features.includes(feature));
            if (!picked.length) throw new Error('Choose at least one new permission.');
            return connect(api, [...account.features, ...picked], account.id);
          })),
        )
      : null,
    h(
      'div',
      { class: 'row' },
      account.status === 'needs_reauth'
        ? button('Reconnect', () => connect(api, account.features, account.id))
        : button(account.status === 'paused' ? 'Resume sync' : 'Pause sync', async () => {
            await api('/v1/connections/update', { method: 'POST', body: { accountId: account.id, paused: account.status !== 'paused' } });
            toast(account.status === 'paused' ? 'Sync resumed.' : 'Sync paused. Nothing new is read until you resume.', 'success');
            await redraw();
          }, { variant: 'ghost' }),
      account.status === 'active'
        ? button('Resync', async () => {
            await api('/v1/connections/resync', { method: 'POST', body: { accountId: account.id } });
            toast('A full resync is queued.', 'success');
            await redraw();
          }, { variant: 'ghost' })
        : null,
      button('Disconnect…', async () => {
        const wipe = checkbox('Also delete everything synced from this account', true, {}, 'Summaries, drafts, follow-ups, contacts and search data from this mailbox.');
        const ok = await confirmDialog({
          title: `Disconnect ${account.email}?`,
          body: ['PigeonBox stops syncing, revokes its Google access and deletes the stored credentials. Your Gmail is not changed.'],
          extra: wipe,
          confirm: 'Disconnect',
          danger: true,
        });
        if (!ok) return;
        await api('/v1/connections/disconnect', { method: 'POST', body: { accountId: account.id, deleteData: wipe.querySelector('input').checked } });
        toast('Disconnected.', 'success');
        await redraw();
      }, { variant: 'danger-ghost' }),
    ),
  );
}

export async function render({ api, landing }) {
  const root = h('div', { class: 'stack' });
  const justConnected = landing.connected === '1';
  const banner =
    landing.connected === '1'
      ? note(
          landing.missing
            ? `Connected, but Google did not grant: ${landing.missing.split(',').map((feature) => FEATURES[feature]?.title ?? feature).join(', ')}. Those features stay off; add them any time.`
            : 'Connected. PigeonBox is doing the first sync now; this page updates as it goes.',
          landing.missing ? 'warn' : 'success',
        )
      : landing.error
        ? note(ERRORS[landing.error] ?? 'Google connection failed. Try again.', 'error')
        : null;
  delete landing.connected;
  delete landing.error;
  delete landing.missing;

  const draw = async () => {
    const data = await accounts(true);
    const fresh = featurePicker(['mail_read', 'drafts'], ['mail_read']);
    clear(
      root,
      banner,
      data.googleConfigured ? null : note('Google sign-in is not configured on this server yet, so accounts cannot be connected.', 'warn'),
      data.accounts.length ? data.accounts.map((account) => accountCard(account, api, draw)) : empty('No Google account is connected.'),
      data.googleConfigured && data.accounts.length < data.maxAccounts
        ? card(
            data.accounts.length ? 'Connect another account' : 'Connect Google',
            h('p', {}, 'Pick what PigeonBox Cloud may do. Reading mail is required for always-on features; everything else is optional and can be added later.'),
            fresh.el,
            h('div', { class: 'row' }, button('Continue to Google', () => connect(api, fresh.picked()))),
            h('p', { class: 'hint' }, 'Credentials are encrypted and stay on PigeonBox’s servers. The extension never receives them.'),
          )
        : data.accounts.length >= data.maxAccounts
          ? h('p', { class: 'hint' }, `You can connect up to ${plural(data.maxAccounts, 'account')}.`)
          : null,
    );
  };
  await draw();
  // Keep sync health current while the first sync runs.
  if (justConnected) {
    let rounds = 0;
    const timer = setInterval(async () => {
      rounds += 1;
      if (!root.isConnected || rounds > 20) return clearInterval(timer);
      await draw().catch(() => undefined);
    }, 6_000);
  }
  return root;
}
