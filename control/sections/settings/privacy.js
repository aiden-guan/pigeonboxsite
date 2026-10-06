import { button, confirmDialog, h, manifest, settings, toast, toggle } from '../../ui.js';
import { load } from './store.js';

/** Local privacy: where data lives, the optional counters, and clearing local data. */
export async function render({ ext }) {
  const { analytics } = await load(ext);

  return [
    settings(
      { index: '01', title: 'Where your data is', text: 'In Local mode nothing goes to PigeonBox.' },
      manifest([
        ['On this computer', 'Your mail index, settings, drafts and downloaded models stay in this browser.'],
        ['AI provider', 'Only when you set one up, the email content a request needs is sent to that provider.'],
        ['PigeonBox Cloud', 'Only after you switch to Cloud. This page then shows what Cloud keeps.'],
        ['Tracking', 'Opens and clicks are recorded by the tracker you set up.'],
      ]),
    ),
    settings(
      { index: '02', title: 'Product counters' },
      toggle('Keep content-free product counters on this computer', analytics, (enabled) => ext('SET_ANALYTICS', { enabled }), 'Off by default. Counts feature use; stores no mail, query text, addresses, documents or timestamps. Nothing is sent anywhere. Turning this off clears the counters.'),
    ),
    settings(
      { index: '03', title: 'Clear local data', text: 'Your settings are kept.' },
      h(
        'div',
        { class: 'row' },
        button('Clear local mail index…', async () => {
          const ok = await confirmDialog({ title: 'Clear the mail index on this computer?', body: 'PigeonBox rebuilds it as you use Gmail. Cloud data and your settings are unaffected.', confirm: 'Clear index', danger: true });
          if (!ok) return;
          await ext('ACTION', { action: 'clear_index' });
          toast('Local mail index cleared.', 'success');
        }, { variant: 'danger-ghost', busy: 'Clearing…' }),
        button('Clear AI cache', async () => {
          await ext('ACTION', { action: 'clear_ai_cache' });
          toast('AI cache cleared.', 'success');
        }, { variant: 'ghost', busy: 'Clearing…' }),
      ),
    ),
  ];
}
