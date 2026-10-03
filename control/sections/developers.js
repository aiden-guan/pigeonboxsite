import { API_BASE } from '../../lib/session.js';
import { ago, button, checkbox, clear, confirmDialog, copyText, day, field, h, input, note, pill, secretDialog, select, surface, table, tabs } from '../ui.js';

// The API's origin: same-origin on Cloud, the named API when the website hosts this page.
const MCP_URL = `${API_BASE || location.origin}/v1/mcp`;

const SCOPES = [
  ['read', 'Read', 'Search mail PigeonBox has synced, threads, contacts, follow-ups, calendar availability.'],
  ['prepare', 'Prepare', 'Prepare drafts, events and reminders inside PigeonBox. Nothing changes in Gmail.'],
  ['write', 'Write', 'Label, archive, place drafts, create events — audited and undoable. Sending only creates an approval for you.'],
];
const EVENTS = [
  ['approval', 'Approval waiting'],
  ['follow_up_due', 'Follow-up due'],
  ['briefing', 'Briefing ready'],
  ['draft_ready', 'Draft ready'],
  ['sync_problem', 'Sync problem'],
  ['mention', 'Mentioned'],
  ['assignment', 'Assigned'],
  ['engagement', 'Engagement'],
];

function tokens(api) {
  return async () => {
    const holder = h('div', { class: 'stack' });
    const draw = async () => {
      const { tokens: list } = await api('/v1/control/tokens');
      const name = input({ maxLength: 120, placeholder: 'e.g. Claude Desktop', attrs: { 'aria-label': 'Token name' } });
      const boxes = SCOPES.map(([value, label, hint]) => checkbox(label, value === 'read', { value }, hint));
      const expiry = select([['30', '30 days'], ['90', '90 days'], ['365', '1 year'], ['never', 'No expiry']], '90');
      clear(
        holder,
        surface(
          'slip',
          { title: 'New token', className: 'composer' },
          field('Name', name),
          h('div', { class: 'checks' }, boxes),
          field('Expires', expiry),
          h('div', { class: 'row' }, button('Create token', async () => {
            const scopes = boxes.map((box) => box.querySelector('input')).filter((box) => box.checked).map((box) => box.value);
            if (!scopes.length) throw new Error('Choose at least one scope.');
            const created = await api('/v1/control/tokens/create', { method: 'POST', body: { name: name.value.trim() || 'API token', scopes, expiresInDays: expiry.value === 'never' ? null : Number(expiry.value) } });
            const config = JSON.stringify({ mcpServers: { pigeonbox: { type: 'http', url: MCP_URL, headers: { Authorization: `Bearer ${created.token}` } } } }, null, 2);
            await secretDialog('Your new token', created.token, ['Copy it now: PigeonBox stores only a hash and cannot show it again.'], h('details', { class: 'disclosure' }, h('summary', {}, 'MCP client configuration'), h('pre', { class: 'code' }, config)));
            await draw();
          })),
        ),
        surface(
          'ledger',
          { title: 'Tokens' },
          table(
            [
              { label: 'Name', render: (row) => h('span', {}, row.name, h('span', { class: 'muted' }, ` · ${row.prefix}…`)) },
              { label: 'Scopes', render: (row) => h('div', { class: 'chips' }, row.scopes.map((scope) => pill(scope, scope === 'write' ? 'warn' : 'neutral'))) },
              { label: 'Last used', render: (row) => (row.lastUsedAt ? ago(row.lastUsedAt) : 'Never') },
              { label: 'Expires', render: (row) => (row.revokedAt ? pill('Revoked', 'neutral') : row.expiresAt ? day(row.expiresAt) : 'Never') },
              {
                label: '',
                render: (row) =>
                  row.revokedAt
                    ? null
                    : button('Revoke', async () => {
                        if (!(await confirmDialog({ title: `Revoke “${row.name}”?`, body: ['Anything using it stops working immediately.'], confirm: 'Revoke', danger: true }))) return;
                        await api('/v1/control/tokens/revoke', { method: 'POST', body: { id: row.id } });
                        await draw();
                      }, { small: true, variant: 'danger-ghost' }),
              },
            ],
            list,
            { emptyText: 'No tokens yet.' },
          ),
        ),
      );
    };
    await draw();
    const endpoint = MCP_URL;
    return h(
      'div',
      { class: 'stack' },
      h(
        'div',
        { class: 'term-block' },
        h('div', { class: 'term-bar' }, h('span', {}, 'MCP endpoint'), button('Copy', () => copyText(endpoint), { variant: 'ghost', small: true, busy: 'Copying…' })),
        h('pre', {}, h('span', { class: 'p', attrs: { 'aria-hidden': 'true' } }, '› '), endpoint),
      ),
      note('Tokens can never approve anything, change your account, manage Google connections or send email. Everything they do is audited under the token’s name.', 'info'),
      holder,
    );
  };
}

function webhooks(api) {
  return async () => {
    const holder = h('div', { class: 'stack' });
    const draw = async () => {
      const { webhooks: list } = await api('/v1/control/webhooks');
      const url = input({ type: 'url', placeholder: 'https://example.com/pigeonbox', attrs: { 'aria-label': 'Webhook URL' } });
      const boxes = EVENTS.map(([value, label]) => checkbox(label, value === 'approval', { value }));
      clear(
        holder,
        surface(
          'slip',
          { title: 'New webhook', className: 'composer' },
          field('HTTPS URL', url, 'Public HTTPS endpoints only. Deliveries are signed with a secret you get once.'),
          h('div', { class: 'checks two' }, boxes),
          h('div', { class: 'row' }, button('Add webhook', async () => {
            const events = boxes.map((box) => box.querySelector('input')).filter((box) => box.checked).map((box) => box.value);
            if (!events.length) throw new Error('Choose at least one event.');
            const created = await api('/v1/control/webhooks/create', { method: 'POST', body: { url: url.value.trim(), events } });
            await secretDialog('Signing secret', created.secret, ['Each delivery has a PigeonBox-Signature header, t=<timestamp>,v1=<HMAC-SHA256 of "timestamp.body">. Verify it with this secret, which is shown once.']);
            await draw();
          })),
        ),
        surface(
          'ledger',
          { title: 'Webhooks' },
          table(
            [
              { label: 'URL', render: (row) => row.url },
              { label: 'Events', render: (row) => row.events.length },
              { label: 'Status', render: (row) => (!row.enabled ? pill('Disabled after failures', 'bad') : row.failures ? pill(`${row.failures} failures`, 'warn') : pill('OK', 'good')) },
              { label: 'Last delivery', render: (row) => (row.lastDeliveryAt ? `${ago(row.lastDeliveryAt)}${row.lastStatus ? ` · ${row.lastStatus}` : ''}` : '—') },
              {
                label: '',
                render: (row) =>
                  button('Delete', async () => {
                    await api('/v1/control/webhooks/delete', { method: 'POST', body: { id: row.id } });
                    await draw();
                  }, { small: true, variant: 'danger-ghost' }),
              },
            ],
            list,
            { emptyText: 'No webhooks.' },
          ),
        ),
      );
    };
    await draw();
    return h('div', { class: 'stack' }, note('Deliveries carry the notification: its type, IDs, title and a short PigeonBox-written summary, which can include subject lines. Never email bodies.', 'info'), holder);
  };
}

export async function render({ api }) {
  return tabs([
    ['tokens', 'Tokens & MCP', tokens(api)],
    ['webhooks', 'Webhooks', webhooks(api)],
  ]);
}
