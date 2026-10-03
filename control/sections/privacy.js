import { button, card, clear, confirmDialog, h, link, note, pill, select, table, toast, toggle } from '../ui.js';

const CONTENT = {
  metadata: ['Metadata', 'neutral', 'IDs, dates, addresses and states. No message text.'],
  encrypted: ['Encrypted', 'good', 'Sealed with AES-256-GCM using keys only the PigeonBox servers hold.'],
  configuration: ['Settings', 'neutral', 'Your preferences and rules.'],
};
const RETENTION = [
  ['7', '7 days'],
  ['30', '30 days'],
  ['90', '90 days'],
  ['180', '6 months'],
  ['365', '1 year'],
];

export async function render({ api }) {
  const root = h('div', { class: 'stack' });
  const draw = async () => {
    const { inventory, fastRecall } = await api('/v1/control/privacy');
    const retention = select(RETENTION, String(fastRecall.retentionDays));
    retention.addEventListener('change', async () => {
      try {
        await api('/v1/preferences/update', { method: 'POST', body: { preferences: { fastRecall: { retentionDays: Number(retention.value) } } } });
        toast('Retention updated. Older excerpts are deleted on the next sweep.', 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
    clear(
      root,
      h('p', { class: 'lede' }, 'What PigeonBox Cloud keeps about your mail, and how. Local PigeonBox data in your browser is separate and never shown here.'),
      card(
        'Fast Recall',
        h('p', {}, 'By default PigeonBox keeps no message text: Ask Pigeon searches summaries and re-reads Gmail when it needs detail. Fast Recall keeps encrypted excerpts of synced messages so deep questions are answered faster.'),
        toggle('Keep encrypted excerpts for Fast Recall', fastRecall.enabled, async (on) => {
          if (!on && !(await confirmDialog({ title: 'Turn off Fast Recall?', body: ['All stored excerpts are deleted immediately.'], confirm: 'Turn off and delete', danger: true }))) throw new Error('Kept on.');
          await api('/v1/preferences/update', { method: 'POST', body: { preferences: { fastRecall: { enabled: on } } } });
          toast(on ? 'Fast Recall is on. New mail is indexed as it syncs.' : 'Fast Recall is off and its excerpts were deleted.', 'success');
          await draw();
        }),
        h('div', { class: 'row' }, h('label', { class: 'inline-label' }, 'Keep excerpts for ', retention)),
      ),
      card(
        'What is stored',
        table(
          [
            { label: 'Data', render: (row) => row.label },
            { label: 'How', render: (row) => h('span', { title: CONTENT[row.content][2] }, pill(CONTENT[row.content][0], CONTENT[row.content][1])) },
            { label: 'Records', numeric: true, render: (row) => row.count.toLocaleString() },
          ],
          inventory,
        ),
        h('p', { class: 'hint' }, 'Credentials for Google are encrypted and never leave PigeonBox’s servers. Logs never contain message text, prompts, AI output or credentials.'),
      ),
      card(
        'Delete synced mail data',
        h('p', {}, 'Deletes everything PigeonBox derived from your mail — summaries, drafts, follow-ups, contacts, search data and excerpts — across all connections. Connections stay; new mail syncs from now on. Gmail is not changed.'),
        h('div', { class: 'row' }, button('Delete synced mail data…', async () => {
          const ok = await confirmDialog({ title: 'Delete synced mail data?', body: ['This cannot be undone.'], confirm: 'Delete', danger: true, typed: 'delete synced mail data' });
          if (!ok) return;
          const { removed } = await api('/v1/control/privacy/purge-mail', { method: 'POST', body: { confirm: 'delete synced mail data' } });
          toast(`Deleted ${removed.toLocaleString()} records.`, 'success');
          await draw();
        }, { variant: 'danger-ghost' })),
      ),
      card(
        'More',
        h('ul', { class: 'plain' }, h('li', {}, link('Inspect or forget personal memories', '#memory')), h('li', {}, link('Disconnect a Google account', '#connections'), ' — revokes access and deletes its credentials.'), h('li', {}, link('Delete your PigeonBox Cloud account', '/account'), ' — closes your Cloud account and deletes its data.'), h('li', {}, link('Read the privacy notice', '/privacy'))),
        note('Email content is treated as untrusted data: instructions inside an email are never followed by PigeonBox’s AI.', 'info'),
      ),
    );
  };
  await draw();
  return root;
}
