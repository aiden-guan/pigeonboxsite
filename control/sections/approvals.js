import { ago, button, card, clear, confirmDialog, empty, h, humanize, key, note, pill, tabs, textarea, when } from '../ui.js';
import { accountEmails, gmailLink, tierPill } from '../shared.js';

const PLACEHOLDER = /\[(?:[A-Z][A-Z ]+ NEEDED|CONFIRM [A-Z ]+|DATE|TIME|LINK|NAME|ATTACHMENT|AMOUNT)\]/g;

function preview(approval, onEdit) {
  const p = approval.preview;
  const parts = [];
  if (p.to?.length) parts.push(h('p', { class: 'kv' }, h('span', {}, 'To'), p.to.join(', ')));
  if (p.cc?.length) parts.push(h('p', { class: 'kv' }, h('span', {}, 'Cc'), p.cc.join(', ')));
  if (p.subject) parts.push(h('p', { class: 'kv' }, h('span', {}, 'Subject'), p.subject));
  if (p.event) {
    parts.push(h('p', { class: 'kv' }, h('span', {}, 'Event'), p.event.title));
    parts.push(h('p', { class: 'kv' }, h('span', {}, 'When'), `${when(p.event.start)} – ${when(p.event.end, { timeStyle: 'short' })}`));
    if (p.event.attendees.length) parts.push(h('p', { class: 'kv' }, h('span', {}, 'Invites'), p.event.attendees.join(', ')));
  }
  if (p.change) parts.push(h('p', { class: 'kv' }, h('span', {}, 'Change'), p.change));
  if (p.count !== undefined) parts.push(h('p', { class: 'kv' }, h('span', {}, 'Count'), String(p.count)));
  if (p.body !== undefined) {
    const editable = approval.status === 'pending' && approval.kind === 'send_email';
    const body = textarea({ value: p.body, rows: Math.min(14, Math.max(5, p.body.split('\n').length + 1)), readOnly: !editable, attrs: { 'aria-label': 'Message body' } });
    if (editable) body.addEventListener('input', () => onEdit(body.value));
    parts.push(body);
  }
  return h('div', { class: 'preview' }, parts);
}

function approvalCard(approval, emails, api, refresh) {
  let edited = null;
  const warning = h('div');
  const approve = button('Approve', async () => {
    const body = edited ?? approval.preview.body;
    const open = (body ?? '').match(PLACEHOLDER) ?? [];
    if (open.length) throw new Error(`Fill in ${[...new Set(open)].join(', ')} before approving.`);
    const sends = approval.kind === 'send_email';
    if (sends) {
      const ok = await confirmDialog({
        title: approval.preview.count && approval.preview.count > 1 ? `Send ${approval.preview.count} emails?` : 'Send this email?',
        body: approval.preview.count && approval.preview.count > 1 ? 'Each person receives their own message within the sending window. Replies and unsubscribes stop it for that person.' : `It goes to ${approval.preview.to?.join(', ') ?? 'the recipients shown'} exactly as shown.`,
        confirm: 'Send',
      });
      if (!ok) return;
    }
    await api('/v1/approvals/decide', { method: 'POST', body: { id: approval.id, decision: 'approve', idempotencyKey: key(), ...(edited !== null && edited !== approval.preview.body ? { edits: { body: edited } } : {}) } });
    await refresh(sends ? 'Approved. Sending now.' : 'Approved.');
  }, { busy: 'Approving…' });
  const reject = button('Reject', async () => {
    await api('/v1/approvals/decide', { method: 'POST', body: { id: approval.id, decision: 'reject', idempotencyKey: key() } });
    await refresh('Rejected. Nothing was done.');
  }, { variant: 'ghost', busy: 'Rejecting…' });

  const updateWarning = () => {
    const open = [...new Set((edited ?? approval.preview.body ?? '').match(PLACEHOLDER) ?? [])];
    clear(warning, open.length ? note(`Fill in ${open.join(', ')} before approving.`, 'warn') : null);
  };
  updateWarning();

  return h(
    'article',
    { class: 'card approval' },
    h('header', { class: 'approval-head' }, h('div', {}, h('h2', {}, approval.title), h('p', { class: 'muted' }, `${approval.responsible.name} · ${ago(approval.createdAt)}${approval.expiresAt ? ` · expires ${ago(approval.expiresAt)}` : ''}`)), tierPill(approval.tier)),
    h('p', {}, approval.why),
    preview(approval, (value) => {
      edited = value;
      updateWarning();
    }),
    approval.sources.length
      ? h('div', { class: 'sources' }, h('span', { class: 'muted' }, 'Based on '), approval.sources.map((source) => (source.gmailThreadId ? gmailLink(source.title, emails.get(source.accountId), source.gmailThreadId) : h('span', { class: 'source' }, source.title))))
      : null,
    warning,
    approval.status === 'pending'
      ? h('div', { class: 'row' }, approve, reject)
      : h('p', { class: 'muted' }, `${humanize(approval.status)}${approval.decidedAt ? ` ${ago(approval.decidedAt)}` : ''}${approval.result ? ` · ${approval.result.message}` : ''}`),
  );
}

export async function render({ api, refreshCounts, toast }) {
  const emails = await accountEmails();
  const list = (status) => async () => {
    const holder = h('div', { class: 'stack' });
    const draw = async () => {
      const { approvals } = await api('/v1/approvals/list', { method: 'POST', body: { status, limit: 50 } });
      const refresh = async (message) => {
        toast(message, 'success');
        refreshCounts();
        await draw();
      };
      clear(
        holder,
        approvals.length
          ? approvals.map((approval) => approvalCard(approval, emails, api, refresh))
          : empty(status === 'pending' ? 'Nothing is waiting for you. Sends, invitations and anything an automation is not allowed to do on its own will appear here first.' : 'No decisions yet.'),
      );
    };
    await draw();
    return holder;
  };
  return h(
    'div',
    { class: 'stack' },
    h('p', { class: 'lede' }, 'PigeonBox never sends email or invites people on its own. Everything that needs your say waits here, in Gmail’s side panel and in the extension, with exactly what would happen.'),
    tabs([
      ['pending', 'Waiting', list('pending')],
      ['decided', 'Decided', list('decided')],
    ]),
    card(null, pill('Tier 0–1', 'neutral'), ' Read-only or undoable changes. ', pill('Tier 2', 'info'), ' Visible changes such as Gmail drafts or calendar holds. ', pill('Tier 3', 'warn'), ' Sending and invitations, always approved one by one.'),
  );
}
