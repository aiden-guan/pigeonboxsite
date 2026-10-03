import { button, clear, confirmDialog, day, emptyState, field, h, input, link, pill, select, surface, toast, toggle } from '../ui.js';

const CATEGORIES = [
  ['', 'All categories'],
  ['people', 'People'],
  ['projects', 'Projects'],
  ['classes', 'Classes'],
  ['logistics', 'Recent context'],
  ['decisions', 'Decisions'],
  ['preferences', 'Preferences'],
  ['other', 'Other'],
];
const CATEGORY = Object.fromEntries(CATEGORIES.filter(([value]) => value));

export async function render({ api }) {
  const root = h('div', { class: 'stack memory-view' });
  const query = input({ type: 'search', placeholder: 'Search a person, class or project', maxLength: 500, attrs: { 'aria-label': 'Search memories' } });
  const category = select(CATEGORIES, '');
  category.setAttribute('aria-label', 'Memory category');
  let cursor = null;
  let revision = 0;
  const list = h('div', { class: 'memory-slips', attrs: { 'aria-live': 'polite' } });
  const more = button('Load more', () => load(true), { variant: 'ghost' });
  more.hidden = true;

  const nothing = () =>
    emptyState({ state: 'map', title: query.value.trim() || category.value ? 'Nothing matches that search' : 'Nothing remembered yet', text: 'No memories yet. Useful facts appear here as connected mail is analyzed.', level: 'h3' });

  const drawItem = (memory) => {
    const item = h('article', { class: 'memory-slip' });
    const body = h('p', { class: 'ms-text' }, memory.text);
    const correction = h('textarea', {
      class: 'input',
      value: memory.text,
      required: true,
      minLength: 10,
      maxLength: 600,
      attrs: { 'aria-label': 'Correct remembered fact' },
    });
    const editor = h(
      'div',
      { class: 'stack', hidden: true },
      correction,
      h(
        'div',
        { class: 'row tight' },
        button('Save correction', async () => {
          const { memory: updated } = await api('/v1/memory/update', { method: 'POST', body: { memoryId: memory.id, text: correction.value } });
          item.replaceWith(drawItem(updated));
          toast('Correction saved.', 'success');
        }),
        button(
          'Cancel',
          () => {
            editor.hidden = true;
            body.hidden = false;
          },
          { variant: 'ghost' },
        ),
      ),
    );
    const sources = h(
      'details',
      {},
      h('summary', {}, 'Sources and freshness'),
      memory.sources.map((source) => h('p', { class: 'hint' }, `From “${source.title}”${source.at ? ` · ${day(source.at)}` : ''}`)),
      !memory.sources.length ? h('p', { class: 'hint' }, 'Saved correction; the original account is disconnected.') : null,
      h('p', { class: 'hint' }, memory.validUntil ? `Useful until ${day(memory.validUntil)}.` : `Last confirmed ${day(memory.lastConfirmedAt)}.`),
    );
    return clear(
      item,
      h(
        'div',
        { class: 'ms-meta' },
        h('span', { class: 'ms-cat' }, CATEGORY[memory.category] ?? memory.category),
        memory.corrected ? pill('Corrected by you', 'good') : null,
        memory.validUntil && Date.parse(memory.validUntil) <= Date.now() ? pill('Expired', 'neutral') : null,
      ),
      h(
        'div',
        { class: 'ms-body' },
        body,
        editor,
        sources,
        h(
          'div',
          { class: 'row' },
          button(
            'Correct',
            () => {
              editor.hidden = false;
              body.hidden = true;
              correction.focus();
            },
            { variant: 'ghost', small: true },
          ),
          button(
            'Forget',
            async () => {
              await api('/v1/memory/forget', { method: 'POST', body: { memoryId: memory.id } });
              item.classList.add('is-forgotten');
              setTimeout(() => {
                item.remove();
                if (!list.children.length) list.append(nothing());
              }, 220);
              toast('Memory forgotten. Gmail is unchanged.', 'success');
            },
            { variant: 'danger-ghost', small: true },
          ),
        ),
      ),
    );
  };

  async function load(append = false) {
    const current = ++revision;
    list.setAttribute('aria-busy', 'true');
    try {
      const result = await api('/v1/memory/list', {
        method: 'POST',
        body: { query: query.value.trim() || undefined, category: category.value || undefined, cursor: append ? cursor : undefined, limit: 20 },
      });
      if (current !== revision) return;
      if (!append) clear(list);
      for (const memory of result.memories) list.append(drawItem(memory));
      if (!list.children.length) list.append(nothing());
      cursor = result.nextCursor;
      more.hidden = !cursor;
    } finally {
      if (current === revision) list.removeAttribute('aria-busy');
    }
  }

  const { preferences } = await api('/v1/preferences');
  const settings = Object.entries({
    enabled: 'Learn useful personal context',
    learnFromReceivedMail: 'Learn facts from received mail',
    learnFromSentMail: 'Learn facts and writing structure from sent mail',
    learnFromDraftEdits: 'Learn writing structure from my draft edits',
  }).map(([key, label]) =>
    toggle(label, preferences.memory[key], async (on) => {
      await api('/v1/preferences/update', { method: 'POST', body: { preferences: { memory: { [key]: on } } } });
      toast('Memory preferences saved.', 'success');
    }),
  );

  // Explicit search avoids network and vector work on every keystroke.
  const search = button('Search', () => load(), { variant: 'ghost' });
  clear(
    root,
    surface(
      'ledger',
      { title: 'Remembered facts' },
      h(
        'form',
        {
          class: 'memory-tools',
          attrs: { role: 'search' },
          on: {
            submit: (event) => {
              event.preventDefault();
              search.click();
            },
          },
        },
        field('Search memories', query),
        field('Category', category),
        h('span', {}, search),
      ),
      list,
      h('div', { class: 'row' }, more),
    ),
    h(
      'div',
      { class: 'grid-2' },
      surface(
        'card',
        { eyebrow: 'Learning', title: 'Personal context' },
        h('p', { class: 'muted' }, 'Derived facts from communication are encrypted in Cloud. Saved memories support drafts and can be wrong. Original email stays in Gmail.'),
        h('div', { class: 'toggles' }, settings),
        h('p', { class: 'hint' }, 'Turning learning off keeps saved facts available. Use Forget all to erase them.'),
        h('p', { class: 'hint' }, `Fast Recall is ${preferences.fastRecall.enabled ? 'on' : 'off'}. Its optional encrypted excerpts are managed separately. `, link('Manage Fast Recall', '#privacy')),
      ),
      surface(
        'card',
        { eyebrow: 'Cannot be undone', title: 'Forget everything', className: 'danger-zone' },
        h('p', { class: 'muted' }, 'Erase all personal facts, entity links, source references and their search data. Contacts, writing profiles and Fast Recall are managed separately. Gmail and your account stay connected.'),
        h(
          'div',
          { class: 'row' },
          button(
            'Forget all memories…',
            async () => {
              if (
                !(await confirmDialog({
                  title: 'Forget all memories?',
                  body: ['This cannot be undone. Learning resumes with future mail.'],
                  typed: 'forget all memories',
                  confirm: 'Forget all memories',
                  danger: true,
                }))
              )
                return;
              await api('/v1/memory/purge', { method: 'POST', body: { confirm: 'forget all memories' } });
              await load();
              toast('All personal memories forgotten.', 'success');
            },
            { variant: 'danger-ghost' },
          ),
        ),
      ),
    ),
  );
  await load();
  return root;
}
