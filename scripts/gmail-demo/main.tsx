import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS } from '@pigeonbox/shared';
import '@extension/ui/product-tokens.css';
import './gmail.css';
import { ACTIONS, CYCLE, STAGES as stages, cameraAt } from './motion';

const ORIGIN = location.origin;
const mails = [
  { threadId: 'sample-maya', sender: 'Maya Chen', subject: 'A few thoughts on the new direction', snippet: 'Love where this is going. Two small things before Friday…', timestamp: new Date(Date.now() - 720000).toISOString(), priority: 'HIGH' },
  { threadId: 'sample-oliver', sender: 'Oliver at Fieldwork', subject: 'The samples are on their way', snippet: 'Your material samples should arrive tomorrow morning.', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { threadId: 'sample-nina', sender: 'Nina & Alex', subject: 'Coffee next week?', snippet: 'We’ll be in your neighborhood on Tuesday. Free at 10?', timestamp: new Date(Date.now() - 7200000).toISOString() },
];
const storageListeners = new Set<(changes: any, area: string) => void>();
const pendingReplies: Array<{ remaining: number; complete: () => void }> = [];
const storage = { local: new Map<string, any>(), session: new Map<string, any>() };
const sampleContext = { tabId: 7, threadId: 'sample-maya', subject: mails[0].subject, sender: 'Maya Chen', owner: { email: 'alex@fieldwork.test', name: 'Alex' } };
let context: typeof sampleContext & { drafting?: boolean } | null = null;
const intel = { classification: { category: 'RESPOND', needsReply: true }, summary: { source: 'model', aiStatus: 'success', summary: { oneLine: 'Maya likes the direction. She needs two small changes before Friday’s review.', keyPoints: ['Use a warmer opening line.', 'Include a screenshot from the new build.'], dates: ['Friday, 10:00 AM'], actionItems: ['Send the updated screens before the review.'] } } };
const product = { runMode: 'local', cloudAvailable: false, cloudConsentAt: null, cloud: { status: 'not_configured', email: null, plan: null, capabilities: [] }, capabilities: ['ask_inbox'], aiDestination: 'this_device', experimental: false, cloudOrigins: [] };

function writeStorage(area: 'local' | 'session', values: Record<string, any>) {
  const changes: Record<string, any> = {};
  for (const [key, value] of Object.entries(values)) {
    changes[key] = { oldValue: storage[area].get(key), newValue: value };
    storage[area].set(key, value);
  }
  queueMicrotask(() => { for (const listener of storageListeners) listener(changes, area); });
}
function fixtureStorage(area: 'local' | 'session') {
  return {
    get: (keys: string | string[] | Record<string, any> | null, callback?: (value: any) => void) => {
      const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : keys ? Object.keys(keys) : [...storage[area].keys()];
      const value = Object.fromEntries(names.map(key => [key, storage[area].has(key) ? storage[area].get(key) : keys && typeof keys === 'object' && !Array.isArray(keys) ? keys[key] : undefined]));
      queueMicrotask(() => callback?.(value));
      return Promise.resolve(value);
    },
    set: (values: Record<string, any>, callback?: () => void) => { writeStorage(area, values); queueMicrotask(() => callback?.()); return Promise.resolve(); },
  };
}
function resetFixture() {
  pendingReplies.length = 0;
  storage.session.clear();
  storage.local.clear();
  context = null;
  writeStorage('local', { workspaceState: { display: 'dock', mode: 'inbox', splitCategory: 'RESPOND' }, pigeonboxAppearance: 'light', cloudPreviewDismissed: true });
}
function applyScene(stage: number) {
  context = stage >= 2 ? { ...sampleContext, drafting: stage === 3 } : null;
  writeStorage('session', { workspaceContexts: context });
  if (stage === 0 || stage === 2 || stage === 7) writeStorage('local', { workspaceState: { display: 'dock', mode: stage === 0 ? 'inbox' : 'home', splitCategory: 'RESPOND' } });
  if (stage === 5) writeStorage('local', { workspaceState: { display: 'dock', mode: 'ask', splitCategory: 'RESPOND' } });
}
resetFixture();
document.documentElement.dataset.pbTheme = 'light';
// The current app's runtime contract, backed only by fictional in-memory data.
// Navigation and thread actions have no external effects. No worker or API runs.
Object.defineProperty(window, 'chrome', { configurable: true, value: {
  runtime: { getURL: (p: string) => `/assets/gmail-demo/${p}`, onMessage: { addListener() {}, removeListener() {} }, openOptionsPage() {},
    sendMessage: (message: any, callback?: (reply: any) => void) => {
      if (message.type === 'WORKSPACE_NAVIGATE') writeStorage('local', { workspaceState: { display: 'dock', mode: message.mode, splitCategory: message.splitCategory || 'RESPOND', cloudSection: message.cloudSection } });
      const reply = message.type === 'GET_PRODUCT_STATE' ? product
        : message.type === 'GET_WORKSPACE_PRESENTATION' ? { state: storage.local.get('workspaceState'), appearance: 'light' }
        : message.type === 'GET_WORKSPACE_CONTEXT' ? { context, tabId: 7, windowId: 4 }
        : message.type === 'GET_THREAD_INTEL' ? intel
        : message.type === 'GET_TRACKED_EMAILS' ? { emails: [] }
        : message.type === 'WORKSPACE_THREAD_ACTION' ? { ok: true }
        : message.type === 'GET_SETTINGS' ? { settings: { ...DEFAULT_SETTINGS, aiMode: 'local', aiApiKey: '', personalApiToken: '', trackerBaseUrl: '' } }
        : message.type === 'LIST_SPLIT' ? { threads: message.category === 'RESPOND' ? mails : [] }
        : message.type === 'RUN_DIAGNOSTICS' ? { coverage: '3 threads indexed on this computer.' }
        : message.type === 'ASK_INBOX' ? { answer: 'Friday’s review is at 10:00 AM. Maya asked for a warmer opening and an updated screenshot before then.', citations: [{ threadId: 'sample-maya', subject: 'A few thoughts on the new direction' }], coverageNote: 'Based on mail indexed on this computer.' }
        : {};
      if (message.type === 'ASK_INBOX') return new Promise(resolve => pendingReplies.push({ remaining: 600, complete: () => { callback?.(reply); resolve(reply); } }));
      queueMicrotask(() => callback?.(reply)); return Promise.resolve(reply);
    },
  },
  storage: { session: fixtureStorage('session'), local: fixtureStorage('local'), onChanged: { addListener: (listener: any) => storageListeners.add(listener), removeListener: (listener: any) => storageListeners.delete(listener) } },
  tabs: { query: () => Promise.resolve([{ id: 7, windowId: 4, active: true, url: 'https://mail.google.com/mail/u/0/#inbox' }]), create: () => Promise.resolve({}), update: () => Promise.resolve({}) }, sidePanel: { open: () => Promise.resolve() },
} });

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    bulb: 'M9 19h6M10 22h4M9 16v-2a6 6 0 1 1 6 0v2z', person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-3a8 8 0 0 1 16 0v3z', check: 'm6 12 4 4 8-9', plus: 'M12 4v16M4 12h16',
    menu: 'M4 6h16M4 12h16M4 18h16', search: 'M21 21l-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16', inbox: 'M3 4h18v16H3zM3 13h5l2 3h4l2-3h5', star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', clock: 'M12 7v5l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0', send: 'm3 3 19 9-19 9 4-9zM7 12h15', file: 'M5 3h9l5 5v13H5zM14 3v6h5', down: 'm7 10 5 5 5-5', edit: 'm4 16 12-12 4 4-12 12H4zM14 6l4 4', refresh: 'M20 7a9 9 0 1 0 1 9M20 2v6h-6', more: 'M12 5h.01M12 12h.01M12 19h.01', back: 'm12 5-7 7 7 7M5 12h15', archive: 'M3 3h18v4H3zM5 7v14h14V7M10 11h4', trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7', mail: 'M3 5h18v14H3zM3 5l9 7 9-7', left: 'm14 7-5 5 5 5', right: 'm10 7 5 5-5 5', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z', help: 'M9 8a3 3 0 1 1 5 2l-2 2v2M12 18h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0', grid: 'M4 4h2v2H4zM11 4h2v2h-2zM18 4h2v2h-2zM4 11h2v2H4zM11 11h2v2h-2zM18 11h2v2h-2zM4 18h2v2H4zM11 18h2v2h-2zM18 18h2v2h-2z', label: 'M3 5h12l6 7-6 7H3z', reply: 'm9 5-7 7 7 7M2 12h11q8 0 8 8', print: 'M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6z', close: 'm6 6 12 12M18 6 6 18', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5', format: 'M3 5h18M12 5v16M8 21h8', clip: 'm8 14 8-8a3 3 0 0 1 4 4L10 20a5 5 0 0 1-7-7L13 3', image: 'M3 3h18v18H3zM3 16l5-5 5 5 3-3 5 5M16 7h.01', smile: 'M8 14q4 5 8 0M8 8h.01M16 8h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0',
  };
  return <svg viewBox="0 0 24 24" className="gm-icon" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.mail} /></svg>;
}
function GmailLogo() {
  return <div className="gm-logo"><svg viewBox="0 0 40 30" aria-hidden="true"><path fill="#4285f4" d="M0 7h7v23H3a3 3 0 0 1-3-3z"/><path fill="#34a853" d="M33 7h7v20a3 3 0 0 1-3 3h-4z"/><path fill="#fbbc04" d="m33 7 7-5v12l-7 5z"/><path fill="#ea4335" d="M0 2 7 7l13 10L33 7v12L20 29 7 19V7z"/><path fill="#c5221f" d="M0 2a4 4 0 0 1 6 0l1 1v12L0 10z"/></svg><span>Gmail</span></div>;
}
function App() {
  const [stage, setStage] = useState(0);
  const [cycle, setCycle] = useState(0);
  const cursor = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const clock = useRef({ elapsed: 0, previous: 0, paused: true, visible: false });
  const frame = stages[stage];
  const composing = stage === 4;
  const inInbox = stage <= 1;

  useEffect(() => {
    let raf: number;
    let lastStage = -1;
    let lastCycle = 0;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const initial = [625, 370];
    const positions = new Map<string, number[]>();
    const clicked = new Set<string>();
    const targetFor = (target: string): HTMLElement | null => {
      const selectors: Record<string, string> = { brief: '.pb-thread-heading', mail: '.pb-brief-actions button:first-child', draft: '.pb-current-thread .gi-action:not(.is-ghost)', ask: '.pb-panel-nav button:last-child', input: '.gi-composer input', submit: '.gi-composer button[type="submit"]', citation: '.pb-ask-content .gi-link' };
      return document.querySelector<HTMLIFrameElement>('.gm-workspace-frame')?.contentDocument?.querySelector(selectors[target]) || null;
    };
    const tick = (now: number) => {
      const state = clock.current;
      if (!state.paused && state.visible && !document.hidden) {
        const delta = Math.min(100, now - (state.previous || now));
        state.elapsed += delta;
        for (let i = pendingReplies.length - 1; i >= 0; i--) {
          pendingReplies[i].remaining -= delta;
          if (pendingReplies[i].remaining <= 0) pendingReplies.splice(i, 1)[0].complete();
        }
      }
      state.previous = now;
      const time = state.elapsed % CYCLE;
      const current = stages.findLastIndex ? stages.findLastIndex(s => time >= s.at) : stages.reduce((n, s, i) => time >= s.at ? i : n, 0);
      const round = Math.floor(state.elapsed / CYCLE);
      if (round !== lastCycle) { resetFixture(); setCycle(round); lastCycle = round; lastStage = -1; positions.clear(); clicked.clear(); }
      const stageChanged = current !== lastStage;
      if (current !== lastStage) { applyScene(current); setStage(current); lastStage = current; }
      const view = cameraAt(time, reducedMotion.matches);
      if (camera.current) camera.current.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`;
      let position = initial;
      let activeClick = '';
      for (const action of ACTIONS) {
        // Travel for 240 ms, settle for 40 ms, click, then hold. No idle roaming.
        if (time < action.at - 280) break;
        const target = targetFor(action.target);
        if (target && !clicked.has(action.id)) {
          const box = target.getBoundingClientRect();
          const panel = document.querySelector('.gm-workspace-frame')!.getBoundingClientRect();
          positions.set(action.id, [(panel.x - view.x) / view.zoom + box.x + box.width * .45, (panel.y - view.y) / view.zoom + box.y + box.height / 2]);
        }
        const destination = positions.get(action.id) || position;
        const p = Math.max(0, Math.min(1, (time - (action.at - 280)) / 240));
        const ease = 1 - Math.pow(1 - p, 3);
        position = [position[0] + (destination[0] - position[0]) * ease, position[1] + (destination[1] - position[1]) * ease];
        if (time >= action.at && time < action.at + 180) activeClick = action.id;
        if (time >= action.at && !clicked.has(action.id) && !state.paused && state.visible) {
          clicked.add(action.id);
          if (action.target === 'input') target?.focus({ preventScroll: true });
          else if (action.target === 'submit') {
            // Use the workspace's supported command contract to submit the
            // animated question. Its own Ask handler renders the response.
            writeStorage('local', { workspaceState: { display: 'dock', mode: 'ask', splitCategory: 'RESPOND', askQuery: 'When is the review with Maya?', askRequestId: `sample-${round}` } });
          }
          else target?.click();
        }
      }
      if (time > CYCLE - 300) {
        const p = Math.min(1, (time - (CYCLE - 300)) / 240);
        const ease = p * p * (3 - 2 * p);
        position = [position[0] + (initial[0] - position[0]) * ease, position[1] + (initial[1] - position[1]) * ease];
      }
      if (cursor.current) {
        cursor.current.style.transform = `translate3d(${position[0]}px,${position[1]}px,0)`;
        cursor.current.classList.toggle('is-clicking', Boolean(activeClick));
        cursor.current.dataset.action = activeClick;
        const recent = [...ACTIONS].reverse().find(action => time >= action.at - 280);
        cursor.current.style.opacity = !recent || time < recent.at + 700 || time > CYCLE - 300 ? '1' : '0';
      }
      if (camera.current) camera.current.dataset.time = String(Math.round(time));
      const question = 'When is the review with Maya?';
      const input = targetFor('input') as HTMLInputElement | null;
      if (input && time >= ACTIONS[4].at && time < ACTIONS[5].at && !state.paused && state.visible) {
        const typed = question.slice(0, Math.floor((time - ACTIONS[4].at) / 40));
        if (input.value !== typed) {
          const win = input.ownerDocument.defaultView!;
          Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set?.call(input, typed);
          input.dispatchEvent(new win.Event('input', { bubbles: true }));
        }
      }
      if (stageChanged || (!state.paused && state.visible)) parent.postMessage({ type: 'pb-demo-progress', stage: current, chapter: stages[current].chapter, label: stages[current].label, progress: time / CYCLE }, ORIGIN);
      raf = requestAnimationFrame(tick);
    };
    const controlWorkspace = () => document.querySelector<HTMLIFrameElement>('.gm-workspace-frame')?.contentWindow?.postMessage({ type: 'pb-workspace-control', paused: clock.current.paused || !clock.current.visible || document.hidden }, ORIGIN);
    const control = (event: MessageEvent) => {
      if (event.origin === ORIGIN && event.source === document.querySelector<HTMLIFrameElement>('.gm-workspace-frame')?.contentWindow && event.data?.type === 'pb-workspace-ready') { controlWorkspace(); return; }
      if (event.origin !== ORIGIN || event.source !== parent || event.data?.type !== 'pb-demo-control') return;
      clock.current.paused = event.data.paused;
      clock.current.visible = event.data.visible;
      document.documentElement.classList.toggle('is-paused', event.data.paused || !event.data.visible);
      controlWorkspace();
      if (typeof event.data.seek === 'number') { clock.current.elapsed = stages[event.data.seek]?.at || 0; lastStage = -1; }
    };
    window.addEventListener('message', control);
    parent.postMessage({ type: 'pb-demo-ready' }, ORIGIN);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('message', control); };
  }, []);

  useLayoutEffect(() => {
    const mail = document.querySelector('.gm-main');
    if (mail) mail.scrollTop = composing ? mail.scrollHeight - mail.clientHeight : 0;
  }, [stage, cycle]);

  return <div className="gm-demo" data-stage={frame.id} aria-label={`Sample walkthrough: ${frame.label}`}>
    <div className="gm-recording" ref={camera}>
    <div className="gm-browser"><span className="gm-traffic"><i/><i/><i/></span><div className="gm-address"><Icon name="lock"/>mail.google.com/mail/u/0/{inInbox ? '#inbox' : '#inbox/sample-maya'}</div><button className="gm-extension" aria-label="Open PigeonBox"><img src="/assets/gmail-demo/icons/icon16.png" alt=""/></button><Icon name="more"/></div>
    <div className="gm-workspace">
      <div className="gm-mailspace">
        <header className="gm-header"><Icon name="menu"/><GmailLogo/><div className="gm-search"><Icon name="search"/><span>Search mail</span><span className="gm-search-filter">☷</span></div><div className="gm-tools"><Icon name="help"/><Icon name="settings"/><Icon name="grid"/><span className="gm-user">A</span></div></header>
        <div className="gm-body"><aside className="gm-nav"><div className="gm-compose"><Icon name="edit"/>Compose</div>{[['inbox', 'Inbox', '3'], ['star', 'Starred', ''], ['clock', 'Snoozed', ''], ['send', 'Sent', ''], ['file', 'Drafts', composing ? '1' : ''], ['down', 'More', '']].map(([icon, label, count]) => <div className={`gm-nav-item ${label === 'Inbox' ? 'is-active' : ''}`} key={label}><Icon name={icon}/><span>{label}</span><b>{count}</b></div>)}<div className="gm-label-heading">Labels<span>+</span></div><div className="gm-nav-item"><Icon name="label"/><span>Work</span></div></aside>
          <main className="gm-main"><div className="gm-toolbar">{(inInbox ? ['inbox', 'refresh', 'more'] : ['back', 'archive', 'trash', 'mail', 'clock', 'more']).map(n => <Icon name={n} key={n}/>)}<span className="gm-pagination">{inInbox ? '1–3 of 3' : '1 of 3'}</span><Icon name="left"/><Icon name="right"/></div>
            {inInbox ? <><div className="gm-categories"><span className="is-active"><Icon name="inbox"/>Primary</span><span><Icon name="label"/>Promotions</span><span><Icon name="grid"/>Social</span></div><div className="gm-messages">{mails.map((mail, i) => <div className="gm-message" key={mail.threadId}><span className="gm-checkbox"/><Icon name="star"/><strong>{mail.sender}</strong><div><b>{mail.subject}</b><span> — {mail.snippet}</span></div><time>{['9:42 AM', '8:54 AM', '8:12 AM'][i]}</time></div>)}</div></> : <article className="gm-thread"><div className="gm-subject"><h1>A few thoughts on the new direction</h1><span>Inbox ×</span><Icon name="print"/></div><div className="gm-sender"><span className="gm-avatar">M</span><div><b>Maya Chen</b><small>&lt;maya@fieldwork.test&gt;</small><p>to me <Icon name="down"/></p></div><time>9:42 AM (12 minutes ago)</time><Icon name="star"/><Icon name="reply"/><Icon name="more"/></div><div className="gm-email"><p>Hi Alex,</p><p>Love where this is going. Two small things before Friday’s review:</p><p>Could we try a warmer opening line, and include a screenshot from the new build?</p><p>The review is Friday at 10:00 AM. Send the updated screens before then and we’ll be ready to go.</p><p>Thanks,<br/>Maya</p></div>{composing ? <div className="gm-reply"><div className="gm-reply-to"><Icon name="reply"/>Maya Chen (maya@fieldwork.test)<span>Draft saved</span></div><div className="gm-reply-text"><p>Hi Maya,</p><p>Thanks for the notes. I’ll warm up the opening line and add a screenshot from the new build. I’ll send the updated screens before our review on Friday at 10:00 AM.</p><p>Best,<br/>Alex</p></div><div className="gm-reply-actions"><span className="gm-send">Send<Icon name="down"/></span>{['format', 'clip', 'link', 'smile', 'image'].map(n => <Icon name={n} key={n}/>)}<span className="gm-draft-label">Draft · not sent</span><Icon name="trash"/></div></div> : <div className="gm-reply-buttons"><span><Icon name="reply"/>Reply</span><span><Icon name="send"/>Forward</span></div>}</article>}
          </main><div className="gm-apprail"><span className="gm-calendar">31</span><span className="gm-keep"><Icon name="bulb"/></span><span className="gm-task"><Icon name="check"/></span><span className="gm-contact"><Icon name="person"/></span><span className="gm-add"><Icon name="plus"/></span></div>
        </div>
      </div>
      <aside className="gm-sidepanel" key={cycle}><div className="gm-sidepanel-bar"><span>PigeonBox</span><Icon name="close"/></div><div className="gm-sidepanel-content"><iframe className="gm-workspace-frame" src={`/assets/gmail-demo/sidepanel.html?cycle=${cycle}`} title="PigeonBox workspace with example mail" tabIndex={-1}/></div></aside>
    </div>
    <div className="gm-cursor" ref={cursor} aria-hidden="true"><div className="gm-click-ring"/><svg viewBox="0 0 28 34"><path d="M3 2v25l6-6 5 11 5-2-5-10h10L3 2Z" fill="#fff" stroke="#202124" strokeWidth="1.8" strokeLinejoin="round"/></svg></div>
    </div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
