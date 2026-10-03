import { ago, button, card, clear, empty, h, link, when } from '../ui.js';
import { accountEmails, gmailLink } from '../shared.js';

const KIND = { morning: 'Morning', end_of_day: 'End of day', meeting: 'Meeting' };

function briefingView(briefing, emails) {
  const sources = new Map(briefing.sources.map((source) => [source.id, source]));
  return h(
    'article',
    { class: 'card briefing' },
    h('header', { class: 'approval-head' }, h('div', {}, h('h2', {}, briefing.title), h('p', { class: 'muted' }, `Prepared ${when(briefing.generatedAt)}`))),
    briefing.sections.map((section) =>
      h(
        'section',
        { class: 'brief-section' },
        h('h3', {}, section.title),
        section.items.length
          ? h(
              'ul',
              { class: 'list' },
              section.items.map((item) =>
                h(
                  'li',
                  {},
                  h(
                    'div',
                    { class: 'list-main' },
                    h('span', {}, item.text),
                    item.sourceIds.length
                      ? h(
                          'span',
                          { class: 'sources' },
                          item.sourceIds.map((id) => {
                            const source = sources.get(id);
                            if (!source) return null;
                            if (source.gmailThreadId) return gmailLink(source.title, emails.get(source.accountId), source.gmailThreadId);
                            if (source.url) return h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer', class: 'source' }, source.title);
                            return h('span', { class: 'source' }, source.title);
                          }),
                        )
                      : null,
                  ),
                ),
              ),
            )
          : h('p', { class: 'muted' }, section.empty ?? 'Nothing here.'),
      ),
    ),
    h('p', { class: 'hint' }, briefing.coverageNote),
  );
}

export async function render({ api }) {
  const emails = await accountEmails();
  const detail = h('div');
  const listEl = h('div');

  const open = async (id) => {
    clear(detail, h('p', { class: 'loading' }, 'Loading briefing…'));
    const { briefing } = await api('/v1/briefings/get', { method: 'POST', body: { id } });
    clear(detail, briefingView(briefing, emails));
  };

  const drawList = async () => {
    const { briefings } = await api('/v1/briefings/list', { method: 'POST', body: { limit: 20 } });
    clear(
      listEl,
      briefings.length
        ? h(
            'ul',
            { class: 'list selectable' },
            briefings.map((item) =>
              h('li', {}, h('button', { type: 'button', class: 'list-button', on: { click: () => open(item.id) } }, h('strong', {}, item.title), h('span', { class: 'muted' }, `${KIND[item.kind] ?? item.kind} · ${ago(item.generatedAt)}`))),
            ),
          )
        : empty('No briefings yet. Morning briefings arrive on workdays at the time you choose in Preferences.'),
    );
    if (briefings[0]) await open(briefings[0].id);
    else clear(detail);
  };

  const generate = (kind) =>
    button(kind === 'morning' ? 'Prepare morning briefing' : 'Prepare end-of-day wrap-up', async () => {
      const { briefing } = await api('/v1/briefings/generate', { method: 'POST', body: { kind } });
      await drawList();
      clear(detail, briefingView(briefing, emails));
    }, { variant: kind === 'morning' ? 'primary' : 'ghost', busy: 'Preparing…' });

  await drawList();
  return h(
    'div',
    { class: 'stack' },
    h('p', { class: 'lede' }, 'Briefings are built from your synced mail and calendar. Every line links to where it came from.'),
    h('div', { class: 'row' }, generate('morning'), generate('end_of_day'), link('Briefing times', '#preferences', { class: 'btn btn-quiet' })),
    h('div', { class: 'grid-sidebar' }, card('Recent', listEl), detail),
  );
}
