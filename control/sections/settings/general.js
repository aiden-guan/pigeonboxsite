import { arrowLink, button, facts, h, link, notice, pill, settings, surface, toast } from '../../ui.js';
import { STORE_URL } from '../../../lib/extension.js';
import { accessNotice, aiDestination, aiProviderLabel, load } from './store.js';

/** Local mode home: how PigeonBox runs, the way to Cloud, and this install. */
export async function render({ ext, extension }) {
  const { settings: s, missingOrigins, product } = await load(ext);
  const cloudReady = product.cloud.status === 'ready';

  const mode = surface(
    'card',
    { eyebrow: 'Mode', title: 'Local · on this computer', actions: pill('In use', 'good') },
    h('p', { class: 'muted' }, 'Private and free, no account needed. Summaries, sorting, Ask and drafts work while Gmail is open. Mail stays in this browser unless you set up an AI provider.'),
    facts([
      ['AI', aiProviderLabel(s)],
      ['Where mail goes', aiDestination(product)],
    ]),
    h('div', { class: 'row' }, link('Change AI', '#ai', { class: 'btn btn-ghost' })),
  );

  const cloud = surface(
    'slip',
    { eyebrow: 'Cloud', title: cloudReady ? 'Your Cloud plan is active' : 'Want it to keep working while Gmail is closed?' },
    h('p', { class: 'muted' }, cloudReady
      ? `PigeonBox here is connected as ${product.cloud.email}, but it still runs locally. Switch to start using Cloud.`
      : 'PigeonBox Cloud syncs your mail in the background and prepares drafts, follow-ups, briefings and calendar context. Sending always waits for your approval.'),
    h('div', { class: 'row' }, link(cloudReady ? 'Switch to Cloud' : 'Set up Cloud', '#cloud', { class: cloudReady ? 'btn btn-primary' : 'btn btn-ghost' })),
  );

  const install = settings(
    { index: '01', title: 'PigeonBox in this browser', text: 'The extension lives in Gmail. Its toolbar icon opens the workspace and ⌘/Ctrl K finds actions.' },
    facts([
      ['Version', `v${extension.version}`],
      ['Updates', extension.storeInstall ? 'Automatic, from the Chrome Web Store' : 'Installed by hand. Download new releases yourself.'],
    ]),
    h(
      'div',
      { class: 'row' },
      button('Open Gmail', () => ext('ACTION', { action: 'open_gmail' }), { variant: 'ghost' }),
      button('Reset workspace position & size', async () => {
        await ext('ACTION', { action: 'reset_workspace' });
        toast('Workspace position reset.', 'success');
      }, { variant: 'ghost' }),
    ),
    extension.storeInstall ? null : h('p', { class: 'hint' }, arrowLink('Releases on GitHub', 'https://github.com/aiden-guan/pigeonbox/releases', { target: '_blank', rel: 'noopener' })),
    extension.storeInstall ? null : h('p', { class: 'hint' }, arrowLink('Or install from the Chrome Web Store for automatic updates', STORE_URL, { target: '_blank', rel: 'noopener' })),
  );

  return [
    accessNotice(ext, missingOrigins),
    product.runMode === 'cloud' ? notice({ tone: 'warn', label: 'Mode', title: 'PigeonBox switched to Cloud', text: 'Reload this page to see Cloud settings.' }) : null,
    h('div', { class: 'grid-2' }, mode, cloud),
    install,
  ];
}
