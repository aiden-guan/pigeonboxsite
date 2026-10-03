// Domain helpers shared by control-plane sections.
import { api } from '../lib/session.js';
import { h, pill } from './ui.js';

/** Open a thread in Gmail for the right account. */
export function gmailHref(accountEmail, threadId) {
  const user = accountEmail ? `?authuser=${encodeURIComponent(accountEmail)}` : '';
  return `https://mail.google.com/mail/${user}#all/${encodeURIComponent(threadId)}`;
}

export function gmailLink(label, accountEmail, threadId) {
  return h('a', { href: gmailHref(accountEmail, threadId), target: '_blank', rel: 'noopener noreferrer', class: 'thread-link' }, label, h('span', { class: 'sr-only' }, ' (opens Gmail)'));
}

let accountsPromise = null;
/** Connected accounts, cached for this page view. */
export function accounts(refresh = false) {
  if (refresh || !accountsPromise) accountsPromise = api('/v1/connections').catch((error) => {
    accountsPromise = null;
    throw error;
  });
  return accountsPromise;
}

export async function accountEmails() {
  try {
    const { accounts: list } = await accounts();
    return new Map(list.map((account) => [account.id, account.email]));
  } catch {
    return new Map();
  }
}

export const FEATURES = {
  mail_read: { title: 'Read and sync mail', detail: 'Keeps triage, follow-ups and drafts current while Gmail is closed.' },
  drafts: { title: 'Create drafts', detail: 'Places prepared drafts in Gmail. Nothing is sent.' },
  organize: { title: 'Organize mail', detail: 'Applies labels and archives for rules you turn on. Every change is undoable.' },
  calendar_read: { title: 'Read calendar', detail: 'Finds free time and prepares meeting briefs.' },
  calendar_write: { title: 'Add calendar events', detail: 'Creates events after you approve them.' },
  send: { title: 'Send mail', detail: 'Only sends messages you approve. Off unless you turn it on.' },
};

const SYNC = {
  initializing: ['Setting up', 'info'],
  healthy: ['Healthy', 'good'],
  catching_up: ['Catching up', 'info'],
  recovering: ['Recovering', 'warn'],
  degraded: ['Degraded', 'warn'],
  stalled: ['Needs attention', 'bad'],
  paused: ['Paused', 'neutral'],
};
export const syncPill = (state) => pill(...(SYNC[state] ?? [state, 'neutral']));

const STATUS = {
  active: ['Connected', 'good'],
  needs_reauth: ['Reconnect needed', 'bad'],
  paused: ['Paused', 'neutral'],
  error: ['Error', 'bad'],
  disconnected: ['Disconnected', 'neutral'],
};
export const statusPill = (status) => pill(...(STATUS[status] ?? [status, 'neutral']));

const TIERS = ['Internal', 'Reversible', 'Visible change', 'Needs approval'];
export const tierPill = (tier) => pill(`Tier ${tier} · ${TIERS[tier] ?? ''}`, tier >= 3 ? 'warn' : tier === 2 ? 'info' : 'neutral');

export const ACTIONS = {
  classify: 'Classify',
  set_state: 'Set state',
  label: 'Add label',
  remove_label: 'Remove label',
  archive: 'Archive',
  mark_important: 'Mark important',
  star: 'Star',
  snooze: 'Snooze',
  remind: 'Remind me',
  create_task: 'Create task',
  create_note: 'Add note',
  notify: 'Notify me',
  run_analysis: 'Analyze',
  draft_reply: 'Prepare reply',
  draft_follow_up: 'Prepare follow-up',
  prepare_event: 'Prepare event',
  create_event: 'Create event',
  send_email: 'Send email',
};
export const actionLabel = (spec) => `${ACTIONS[spec.kind] ?? spec.kind}${spec.params?.label ? ` “${spec.params.label}”` : ''}`;

export const STATES = {
  NEEDS_REPLY: 'Needs reply',
  WAITING_ON_THEM: 'Waiting on them',
  WAITING_ON_ME: 'Waiting on me',
  FYI: 'FYI',
  NOTIFICATION: 'Notification',
  PROMOTION: 'Promotion',
  NEWS: 'News',
  SCHEDULED: 'Scheduled',
  FOLLOW_UP_DUE: 'Follow-up due',
  DONE: 'Done',
};

/** Download text as a file (CSV export). */
export function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const anchor = h('a', { href: '/', download: filename });
  anchor.href = url;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
