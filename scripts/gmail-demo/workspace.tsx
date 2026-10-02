// Keep the real workspace's responsive rules in a panel-sized viewport.
import { createRoot } from 'react-dom/client';
import { PigeonBoxWorkspace } from '@extension/workspace/PigeonBoxWorkspace';
import '@extension/styles.css';
import '@extension/ui/dispatch.css';
import '@extension/ui/system.css';

if (window.parent === window || window.parent.location.origin !== location.origin) throw new Error('The example workspace requires its Gmail fixture.');
Object.defineProperty(window, 'chrome', { configurable: true, value: window.parent.chrome });
document.documentElement.dataset.pbTheme = 'light';
const pausedStyle = document.createElement('style');
pausedStyle.textContent = '.is-paused *, .is-paused *::before, .is-paused *::after { animation-play-state: paused !important; }';
document.head.append(pausedStyle);
window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin === location.origin && event.source === window.parent && event.data?.type === 'pb-workspace-control') document.documentElement.classList.toggle('is-paused', Boolean(event.data.paused));
});
const root = createRoot(document.getElementById('root')!);
root.render(<PigeonBoxWorkspace/>);
window.addEventListener('pagehide', () => root.unmount());
window.parent.postMessage({ type: 'pb-workspace-ready' }, location.origin);
