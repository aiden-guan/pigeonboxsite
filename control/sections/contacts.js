import { ago, button, card, checkbox, clear, day, empty, facts, field, h, input, pill, textarea, toast } from '../ui.js';
import { accountEmails, gmailLink, STATES } from '../shared.js';

const RADAR = [
  ['unansweredImportant', 'Waiting on you'],
  ['promisedFollowUps', 'You promised'],
  ['goingCold', 'Going quiet'],
  ['revived', 'Back in touch'],
  ['upcomingMeetings', 'Meeting soon'],
  ['vipActivity', 'VIP activity'],
];
const WAITING = { on_me: ['Waiting on you', 'warn'], on_them: ['Waiting on them', 'info'], both: ['Both waiting', 'warn'], none: null };

async function brief(contactId, { api, emails, back }) {
  const { brief: b } = await api('/v1/contacts/brief', { method: 'POST', body: { contactId } });
  const c = b.contact;
  const notes = textarea({ value: b.notes, rows: 4, maxLength: 5_000, attrs: { 'aria-label': 'Your notes' } });
  const tags = input({ value: c.tags.join(', '), attrs: { 'aria-label': 'Tags' } });
  const vip = checkbox('VIP', c.vip, {}, 'Mail from VIPs is always treated as important.');
  const commitments = (items, emptyText) =>
    items.length
      ? h('ul', { class: 'list' }, items.map((item) => h('li', {}, h('div', { class: 'list-main' }, h('span', {}, item.text), h('span', { class: 'muted' }, item.dueAt ? `Due ${day(item.dueAt)}` : 'No date')), item.source?.gmailThreadId ? gmailLink('Open thread', emails.get(item.source.accountId), item.source.gmailThreadId) : null)))
      : h('p', { class: 'muted' }, emptyText);

  return h(
    'div',
    { class: 'stack' },
    h('button', { type: 'button', class: 'back', on: { click: () => back() } }, '← Contacts'),
    card(
      null,
      h('header', { class: 'approval-head' }, h('div', {}, h('h2', {}, c.name || c.email), h('p', { class: 'muted' }, [c.name ? c.email : null, c.company].filter(Boolean).join(' · '))), c.vip ? pill('VIP', 'good') : null),
      h('p', {}, b.whoTheyAre),
      facts([
        ['You wrote', `${c.sentCount} times`],
        ['They wrote', `${c.receivedCount} times`],
        ['Last contact', c.lastInteractionAt ? ago(c.lastInteractionAt) : 'Never'],
        ['Next meeting', b.nextMeeting ? `${b.nextMeeting.title} · ${day(b.nextMeeting.start)}` : 'None scheduled'],
      ]),
      b.lastDiscussed ? h('p', {}, h('strong', {}, 'Last discussed: '), b.lastDiscussed.text) : null,
    ),
    h('div', { class: 'grid-2' }, card('You owe them', commitments(b.youOwe, 'Nothing open.')), card('They owe you', commitments(b.theyOwe, 'Nothing open.'))),
    b.importantThreads.length
      ? card('Threads', h('ul', { class: 'list' }, b.importantThreads.map((thread) => h('li', {}, h('div', { class: 'list-main' }, gmailLink(thread.subject || '(no subject)', emails.get(thread.accountId), thread.threadId), h('span', { class: 'muted' }, `${STATES[thread.state] ?? thread.state} · ${ago(thread.lastMessageAt)}`))))))
      : null,
    b.signals.length ? card('Signals', h('ul', { class: 'list' }, b.signals.map((signal) => h('li', {}, h('div', { class: 'list-main' }, h('strong', {}, signal.label), h('span', { class: 'muted' }, signal.explanation)))))) : null,
    card('Timeline', b.timeline.length ? h('ul', { class: 'timeline' }, b.timeline.map((entry) => h('li', {}, h('time', { dateTime: entry.at }, day(entry.at)), h('span', {}, entry.label)))) : empty('No activity yet.')),
    card(
      'Your notes',
      notes,
      field('Tags (comma-separated)', tags),
      vip,
      h('div', { class: 'row' }, button('Save', async () => {
        await api('/v1/contacts/update', {
          method: 'POST',
          body: { contactId: c.id, notes: notes.value, vip: vip.querySelector('input').checked, tags: tags.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20) },
        });
        toast('Saved.', 'success');
      })),
      h('p', { class: 'hint' }, 'Notes are encrypted and only used for your briefs and drafts.'),
    ),
  );
}

export async function render({ api }) {
  const emails = await accountEmails();
  const root = h('div');

  const drawList = async () => {
    const [radar, first] = await Promise.all([api('/v1/contacts/radar'), api('/v1/contacts/list', { method: 'POST', body: { limit: 50 } })]);
    const search = input({ type: 'search', placeholder: 'Search people or companies', attrs: { 'aria-label': 'Search contacts' } });
    const vipOnly = checkbox('VIPs only', false);
    const listEl = h('div');
    const open = async (id) => clear(root, await brief(id, { api, emails, back: drawList }));
    const drawContacts = (contacts) =>
      clear(
        listEl,
        contacts.length
          ? h(
              'ul',
              { class: 'list selectable' },
              contacts.map((contact) => {
                const waiting = WAITING[contact.waiting];
                return h(
                  'li',
                  {},
                  h('button', { type: 'button', class: 'list-button', on: { click: () => open(contact.id) } }, h('strong', {}, contact.name || contact.email), h('span', { class: 'muted' }, `${contact.company ?? contact.domain} · ${contact.lastInteractionAt ? ago(contact.lastInteractionAt) : 'no contact yet'}`)),
                  h('div', { class: 'chips' }, contact.vip ? pill('VIP', 'good') : null, waiting ? pill(...waiting) : null, contact.openCommitments ? pill(`${contact.openCommitments} open`, 'neutral') : null),
                );
              }),
            )
          : empty('No contacts match.'),
      );
    let timer = 0;
    const query = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const result = await api('/v1/contacts/list', { method: 'POST', body: { limit: 50, ...(search.value.trim() ? { query: search.value.trim() } : {}), ...(vipOnly.querySelector('input').checked ? { vipOnly: true } : {}) } }).catch(() => null);
        if (result) drawContacts(result.contacts);
      }, 250);
    };
    search.addEventListener('input', query);
    vipOnly.addEventListener('change', query);
    drawContacts(first.contacts);

    const radarCards = RADAR.filter(([id]) => radar[id].length).map(([id, label]) =>
      card(
        label,
        h(
          'ul',
          { class: 'list' },
          radar[id].slice(0, 5).map((item) =>
            h('li', {}, h('button', { type: 'button', class: 'list-button', on: { click: () => open(item.contact.id) } }, h('strong', {}, item.contact.name || item.contact.email), h('span', { class: 'muted' }, item.reason))),
          ),
        ),
      ),
    );

    clear(
      root,
      h(
        'div',
        { class: 'stack' },
        h('p', { class: 'lede' }, 'Built from dates, counts and open promises in your synced mail. No hidden scores: every item says why it is here.'),
        radarCards.length ? h('div', { class: 'grid-3' }, radarCards) : null,
        card('People', h('div', { class: 'row' }, search, vipOnly), listEl),
      ),
    );
  };
  await drawList();
  return root;
}
