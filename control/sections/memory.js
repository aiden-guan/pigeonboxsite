import { button, card, clear, confirmDialog, day, field, h, input, link, note, pill, select, toast, toggle } from '../ui.js';

export async function render({ api }) {
  const root = h('div', { class: 'stack memory-view' });
  const query = input({ placeholder: 'Search a person, class or project', maxLength: 500, attrs: { 'aria-label': 'Search memories' } });
  const category = select(
    [
      ['', 'All categories'],
      ['people', 'People'],
      ['projects', 'Projects'],
      ['classes', 'Classes'],
      ['logistics', 'Recent context'],
      ['decisions', 'Decisions'],
      ['preferences', 'Preferences'],
      ['other', 'Other'],
    ],
    '',
  );
  category.setAttribute('aria-label', 'Memory category');
  let cursor = null;
  let revision = 0;
  const list = h('div', { class: 'stack', attrs: { 'aria-live': 'polite' } });
  const more = button('Load more', () => load(true), { variant: 'ghost' });
  more.hidden = true;
  const drawItem = (memory) => {
    const item = h('article', { class: 'card stack' });
    const body = h('p', {}, memory.text);
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
        { class: 'row' },
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
        { class: 'row' },
        pill(memory.category),
        memory.corrected ? pill('Corrected by you', 'good') : null,
        memory.validUntil && Date.parse(memory.validUntil) <= Date.now() ? pill('Expired', 'neutral') : null,
      ),
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
            item.remove();
            toast('Memory forgotten. Gmail is unchanged.', 'success');
          },
          { variant: 'danger-ghost', small: true },
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
      if (!list.children.length) list.append(note('No memories yet. Useful facts appear here as connected mail is analyzed.', 'info'));
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
  clear(
    root,
    h('p', { class: 'lede' }, 'The useful details you should not have to explain twice.'),
    card(
      'Personal context',
      h('p', {}, 'Derived facts from communication are encrypted in Cloud. Saved memories support drafts and can be wrong. Original email stays in Gmail.'),
      settings,
      h('p', { class: 'hint' }, 'Turning learning off keeps saved facts available. Use Forget all to erase them.'),
      h(
        'p',
        { class: 'hint' },
        `Fast Recall is ${preferences.fastRecall.enabled ? 'on' : 'off'}. Its optional encrypted excerpts are managed separately. `,
        link('Manage Fast Recall', '#privacy'),
      ),
    ),
    card(
      'Remembered facts',
      h(
        'form',
        {
          class: 'row',
          on: {
            submit: (event) => {
              event.preventDefault();
              search.click();
            },
          },
        },
        field('Search memories', query),
        field('Category', category),
        h(
          'span',
          {},
          button('Search', () => load(), { variant: 'ghost' }),
        ),
      ),
      list,
      more,
    ),
    card(
      'Forget everything',
      h(
        'p',
        {},
        'Erase all personal facts, entity links, source references and their search data. Contacts, writing profiles and Fast Recall are managed separately. Gmail and your account stay connected.',
      ),
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
  );
  // Explicit search avoids network/vector work on every keystroke.
  const search = root.querySelector('form button');
  await load();
  return root;
}
