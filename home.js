import { initGmailDemo } from './gmail-demo.js';
// Homepage interactions. Example mail only; nothing here talks to a server.
import { toast } from '/site.js';
import { initFlow } from '/flow.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function h(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function animateIn(node, cls = 'is-entering', ms = 440) {
  if (reduced() || !node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

/* ---------------- Example mail ---------------- */

const MAIL = {
  maya: {
    cat: 'respond', from: 'Maya Chen', initials: 'MC', av: 'a3', time: '9:42', subject: 'Final review on the launch note',
    snippet: 'Could you soften the opening and update the screenshot?',
    title: 'Two edits by Friday.',
    summary: 'Maya approved the direction. She needs a softer opening line and a screenshot from the new build before Friday’s 10:00 review.',
    next: 'Send the revised note before Friday 10:00.',
    facts: [['Action', 'Soften the opening line'], ['Action', 'Replace the screenshot'], ['Date', 'Fri 10:00 · review'], ['Open', 'Does legal need to see it?']],
    drafts: {
      warm: 'Hi Maya,\n\nThanks for the clear notes. I’ll soften the opening and swap in the new screenshot before Friday’s review.\n\nBest,\nAlex',
      brief: 'Hi Maya — will update the opening and screenshot before Friday at 10. Thanks, Alex',
      formal: 'Hi Maya,\n\nThank you for the feedback. I will revise the opening line and replace the screenshot ahead of Friday’s review.\n\nBest regards,\nAlex',
    },
  },
  priya: {
    cat: 'respond', from: 'Priya Shah', initials: 'PS', av: 'a2', time: '8:18', subject: 'Budget for the next sprint',
    snippet: 'Can you review these numbers before we meet?',
    title: 'Budget review requested.',
    summary: 'Priya sent the next sprint budget and wants it reviewed before Thursday’s 2:00 meeting. Contractor spend on line 4 is the open question.',
    next: 'Review the budget and reply before Thursday.',
    facts: [['Action', 'Review line items'], ['Date', 'Thu 14:00 · meeting'], ['Open', 'Hold contractor spend flat?']],
    drafts: {
      warm: 'Hi Priya,\n\nThanks for pulling this together. The numbers look right to me except line 4 — could we hold contractor spend flat until Q4? Happy to walk through it Thursday.\n\nAlex',
      brief: 'Looks good except line 4 — can we keep contractors flat until Q4? Talk Thursday. — Alex',
      formal: 'Hi Priya,\n\nThank you for sending the budget. I have one question on line 4 regarding contractor spend, which I propose we hold flat until Q4. I can discuss on Thursday.\n\nBest regards,\nAlex',
    },
  },
  devon: {
    cat: 'respond', from: 'Devon Park', initials: 'DP', av: 'a1', time: 'Mon', subject: 'Interview loop — your slot',
    snippet: 'Can you take the systems interview Wednesday or Thursday?',
    title: 'Pick an interview slot.',
    summary: 'Devon needs you for the systems interview in Wednesday’s or Thursday’s loop and asked you to choose by end of day Tuesday.',
    next: 'Reply with a slot by Tuesday.',
    facts: [['Action', 'Choose Wed or Thu'], ['Date', 'Tue EOD · deadline']],
    drafts: {
      warm: 'Hi Devon,\n\nHappy to help. Thursday works best for me — put me down for the systems interview.\n\nAlex',
      brief: 'Thursday works. Put me down. — Alex',
      formal: 'Hi Devon,\n\nThank you for including me. I am available for the systems interview on Thursday.\n\nBest regards,\nAlex',
    },
  },
  jules: {
    cat: 'waiting', from: 'Jules Turner', initials: 'JT', av: 'a2', time: 'Yesterday', subject: 'Re: September handoff',
    snippet: 'I’ll send the handoff notes after the team review.',
    title: 'Waiting on handoff notes.',
    summary: 'Jules said the September handoff notes will follow the team review. Nothing is needed from you yet.',
    next: 'Check back after Wednesday’s team review.',
    facts: [['Waiting', 'Handoff notes from Jules'], ['Date', 'Wed · team review']],
  },
  lena: {
    cat: 'waiting', from: 'Lena Ruiz', initials: 'LR', av: 'a4', time: 'Fri', subject: 'Vendor quote',
    snippet: 'Legal is reviewing the quote now.',
    title: 'Quote with legal.',
    summary: 'Lena is waiting on legal before sending the final vendor quote. She expects to hear back early next week.',
    next: 'No reply needed. Follow up if nothing by Tuesday.',
    facts: [['Waiting', 'Final vendor quote'], ['Date', 'Early next week']],
  },
  alex: {
    cat: 'fyi', from: 'Rui Alves', initials: 'RA', av: 'a1', time: 'Yesterday', subject: 'Design files for tomorrow',
    snippet: 'The updated files are ready in the shared folder.',
    title: 'Design files are ready.',
    summary: 'Rui shared updated design files for tomorrow. They’re ready whenever you want to look.',
    next: 'Open the files before tomorrow’s session.',
    facts: [['Link', 'Shared folder'], ['Date', 'Tomorrow · design session']],
  },
  letter: {
    cat: 'fyi', from: 'The Weekly Letter', initials: 'WL', av: 'a4', time: 'Mon', subject: 'Five things worth reading',
    snippet: 'This week’s notes from the product desk.',
    title: 'A read for later.',
    summary: 'A newsletter. Nothing here asks anything of you.',
    next: 'Read when you have time.',
    facts: [['Type', 'Newsletter']],
  },
  sam: {
    cat: 'followups', from: 'Sam Ortiz', initials: 'SO', av: 'a3', time: 'Tue', subject: 'Proposal for Q4',
    snippet: 'You: Sharing the proposal — let me know what you think.',
    title: 'No reply in four days.',
    summary: 'You sent Sam the Q4 proposal on Tuesday. Tracking shows an open detected and a link click on Tuesday; there’s been no reply since.',
    next: 'Send a short nudge, or wait until Monday.',
    facts: [['Sent', 'Tue 09:02'], ['Signal', 'Open detected · Tue 11:40'], ['Signal', 'Click detected · Tue 11:41']],
    drafts: {
      warm: 'Hi Sam,\n\nJust floating this back up — happy to answer questions on the proposal or adjust the scope.\n\nAlex',
      brief: 'Hi Sam — any thoughts on the Q4 proposal? — Alex',
      formal: 'Hi Sam,\n\nI wanted to follow up on the Q4 proposal I shared on Tuesday. Please let me know if you have any questions.\n\nBest regards,\nAlex',
    },
  },
  rio: {
    cat: 'followups', from: 'Rio Tanaka', initials: 'RT', av: 'a2', time: 'Last wk', subject: 'Contract renewal',
    snippet: 'You: Attached the renewal terms.',
    title: 'Renewal sent, quiet since.',
    summary: 'You sent the renewal terms last week. No activity signal and no reply. The image may have been blocked, so silence isn’t proof it went unread.',
    next: 'Follow up this week.',
    facts: [['Sent', 'Last Thu'], ['Signal', 'None detected']],
    drafts: {
      warm: 'Hi Rio,\n\nChecking in on the renewal terms from last week — anything you’d like to change?\n\nAlex',
      brief: 'Hi Rio — any update on the renewal? — Alex',
      formal: 'Hi Rio,\n\nI am following up on the renewal terms sent last week. Please let me know if you require any changes.\n\nBest regards,\nAlex',
    },
  },
};
const QUEUES = { respond: ['maya', 'priya', 'devon'], waiting: ['jules', 'lena'], fyi: ['alex', 'letter'], followups: ['sam', 'rio'] };
// Example totals per queue (lists show the top threads only).
const TOTALS = { respond: 4, waiting: 3, fyi: 9, followups: 2 };
const ORDER = ['respond', 'waiting', 'fyi', 'followups'];

const ASKS = [
  { q: 'When is the launch review?', a: 'Friday at 10:00. Maya wants the revised note and a new-build screenshot before then.', src: ['Maya Chen', 'Final review on the launch note', '“…a screenshot from the new build before Friday’s 10:00 review.”'] },
  { q: 'What did Priya ask me to do?', a: 'Review the next sprint budget before Thursday’s 2:00 meeting. Line 4, contractor spend, is the open question.', src: ['Priya Shah', 'Budget for the next sprint', '“Can you review these numbers before we meet?”'] },
  { q: 'Who hasn’t replied to me?', a: 'Sam Ortiz (Q4 proposal, sent Tuesday) and Rio Tanaka (contract renewal, last week). Sam’s thread shows an open detected; Rio’s shows no signal.', src: ['Follow-ups', '2 threads', 'Activity signals are not proof a message was read.'] },
];

/* ---------------- B. Dispatch route ---------------- */

function initRoute() {
  const route = $('[data-route]');
  if (!route) return;
  const stops = $$('[role="tab"]', route);
  const panels = stops.map((s) => document.getElementById(s.getAttribute('aria-controls')));
  const bird = $('[data-route-bird]', route);
  const sprite = $('.pidgy', bird);
  const path = $('.route-path', route);
  const states = ['idle', 'route', 'search', 'draft', 'alert'];
  let current = 0;
  let timer = null;

  const set = (i, { focus = false, user = false } = {}) => {
    if (user) stopAuto();
    const prev = current;
    current = i;
    route.style.setProperty('--stop', String(i));
    // The copper route fills up to the current stop (4 equal hops).
    path.style.strokeDashoffset = String(1 - i / (stops.length - 1));
    stops.forEach((s, n) => {
      const on = n === i;
      s.setAttribute('aria-selected', String(on));
      s.tabIndex = on ? 0 : -1;
      s.classList.toggle('is-passed', n < i);
    });
    panels.forEach((p, n) => { p.hidden = n !== i; });
    animateIn(panels[i], 'is-entering', 520);
    sprite.dataset.state = states[i];
    if (prev !== i && !reduced()) {
      sprite.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(0)' }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    if (focus) stops[i].focus();
  };
  const stopAuto = () => { clearInterval(timer); timer = null; };

  stops.forEach((s, i) => {
    s.addEventListener('click', () => set(i, { user: true }));
    s.addEventListener('keydown', (event) => {
      let n = null;
      if (event.key === 'ArrowRight') n = (i + 1) % stops.length;
      else if (event.key === 'ArrowLeft') n = (i - 1 + stops.length) % stops.length;
      else if (event.key === 'Home') n = 0;
      else if (event.key === 'End') n = stops.length - 1;
      if (n === null) return;
      event.preventDefault();
      set(n, { focus: true, user: true });
    });
  });
  route.addEventListener('pointerdown', stopAuto);
  route.addEventListener('focusin', stopAuto);

  set(0);
  // Touch readers choose a stop; automatic panel changes can move the page mid-scroll.
  if (reduced() || matchMedia('(pointer: coarse)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) { stopAuto(); return; }
    io.disconnect();
    // Fly the route once, then hand control to the reader.
    let i = 0;
    timer = setInterval(() => {
      i += 1;
      if (i >= stops.length) { stopAuto(); return; }
      set(i);
    }, 1700);
  }, { threshold: 0.45 });
  io.observe(route);
}

/* ---------------- C. Product lab ---------------- */

function initLab() {
  const lab = $('[data-lab]');
  if (!lab) return;
  const list = $('[data-lab-list]', lab);
  const cats = $$('[data-lab-cat]', lab);
  const bird = $('[data-lab-bird]', lab);
  const tabs = $$('[role="tab"]', lab);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const draftText = $('[data-draft-text]', lab);
  const draftState = $('[data-draft-state]', lab);
  const insert = $('[data-draft-insert]', lab);
  const tones = $$('[data-tone]', lab);
  const askForm = $('[data-ask-form]', lab);
  const askInput = $('[data-ask-input]', lab);
  const askAnswer = $('[data-ask-answer]', lab);
  const askSuggest = $('[data-ask-suggest]', lab);
  let cat = 'respond';
  let selected = 'maya';
  let tone = 'warm';
  let typing = null;

  cats.forEach((c) => { $('b', c).textContent = TOTALS[c.dataset.labCat]; });

  const setTab = (i, focus = false) => {
    tabs.forEach((t, n) => { t.setAttribute('aria-selected', String(n === i)); t.tabIndex = n === i ? 0 : -1; });
    panels.forEach((p, n) => { p.hidden = n !== i; });
    animateIn(panels[i], 'is-entering', 320);
    bird.dataset.state = ['idle', 'draft', 'search'][i];
    if (focus) tabs[i].focus();
    if (i === 1) renderDraft();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setTab(i));
    t.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      setTab((i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true);
    });
  });

  const renderDraft = () => {
    const mail = MAIL[selected];
    clearInterval(typing);
    draftText.classList.remove('is-typing');
    draftState.classList.remove('is-done');
    draftState.textContent = 'Not inserted · not sent';
    insert.disabled = !mail.drafts;
    tones.forEach((t) => { t.disabled = !mail.drafts; });
    if (!mail.drafts) { draftText.textContent = 'No reply needed on this thread. PigeonBox only offers drafts where one is useful.'; return; }
    const text = mail.drafts[tone];
    if (reduced()) { draftText.textContent = text; return; }
    let n = 0;
    draftText.textContent = '';
    draftText.classList.add('is-typing');
    typing = setInterval(() => {
      n = Math.min(text.length, n + 4);
      draftText.textContent = text.slice(0, n);
      if (n >= text.length) { clearInterval(typing); draftText.classList.remove('is-typing'); }
    }, 16);
  };
  tones.forEach((t) => t.addEventListener('click', () => {
    tone = t.dataset.tone;
    tones.forEach((x) => x.setAttribute('aria-pressed', String(x === t)));
    renderDraft();
  }));
  insert.addEventListener('click', () => {
    clearInterval(typing);
    draftText.classList.remove('is-typing');
    draftText.textContent = MAIL[selected].drafts[tone];
    draftState.textContent = 'Inserted into composer · not sent';
    draftState.classList.add('is-done');
    toast('Draft placed in Gmail’s composer. You press Send.', 'draft');
  });

  const answer = (item) => {
    askAnswer.replaceChildren();
    if (!item) {
      const label = h('p', 'label');
      label.append(Object.assign(h('span', 'pidgy pidgy-sm'), { ariaHidden: 'true' }), document.createTextNode('No match'));
      label.firstChild.dataset.state = 'search';
      askAnswer.append(label, h('p', null, 'This example inbox only knows a handful of threads. Try one of the suggested questions.'));
      return;
    }
    askInput.value = item.q;
    askAnswer.append(h('p', 'label', 'Answer'), h('p', null, item.a));
    const src = h('div', 'src');
    src.append(h('span', null, `Source · ${item.src[0]} · ${item.src[1]}`), document.createTextNode(item.src[2]));
    askAnswer.append(src, h('p', 'cov', 'Coverage: threads indexed in this browser. Older mail may not be included.'));
    animateIn(askAnswer, 'is-entering', 320);
  };
  ASKS.forEach((item) => {
    const b = h('button', null, item.q);
    b.type = 'button';
    b.addEventListener('click', () => answer(item));
    askSuggest.append(b);
  });
  askForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const words = askInput.value.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    let best = null;
    let score = 0;
    for (const item of ASKS) {
      const hay = `${item.q} ${item.a} ${item.src.join(' ')}`.toLowerCase();
      const s = words.filter((w) => hay.includes(w)).length;
      if (s > score) { best = item; score = s; }
    }
    answer(best);
  });

  const select = (id, focus = false) => {
    selected = id;
    const mail = MAIL[id];
    $('[data-lab-from]', lab).textContent = `${mail.from} · ${mail.time}`;
    $('[data-lab-title]', lab).textContent = mail.title;
    $('[data-lab-brief]', lab).textContent = mail.summary;
    $('[data-lab-action]', lab).textContent = mail.next;
    const facts = $('[data-lab-facts]', lab);
    facts.replaceChildren(...mail.facts.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
    $$('.l-row', list).forEach((row) => {
      const on = row.dataset.id === id;
      row.setAttribute('aria-pressed', String(on));
      if (on && focus) row.focus();
    });
    const openTab = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    if (openTab === 1) renderDraft();
    else animateIn(panels[openTab], 'is-entering', 320);
  };
  const showCat = (next, focusTab = false) => {
    cat = next;
    cats.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.labCat === next)));
    list.replaceChildren(...QUEUES[next].map((id, i) => {
      const mail = MAIL[id];
      const row = h('button', 'l-row');
      row.type = 'button';
      row.dataset.id = id;
      row.setAttribute('aria-pressed', 'false');
      const av = h('span', `av ${mail.av}`, mail.initials);
      av.setAttribute('aria-hidden', 'true');
      row.append(av, h('strong', null, mail.from), h('time', null, mail.time), h('b', null, mail.subject), h('small', null, mail.snippet));
      if (!reduced()) { row.classList.add('is-arriving'); row.style.animationDelay = `${i * 60}ms`; }
      row.addEventListener('click', () => select(id));
      return row;
    }));
    select(QUEUES[next][0]);
    if (focusTab) cats.find((c) => c.dataset.labCat === next)?.focus();
  };
  cats.forEach((c) => c.addEventListener('click', () => showCat(c.dataset.labCat)));

  lab.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;
    const k = event.key.toLowerCase();
    const ids = QUEUES[cat];
    if (k === 'j' || k === 'k') {
      event.preventDefault();
      const i = ids.indexOf(selected);
      select(ids[(i + (k === 'j' ? 1 : -1) + ids.length) % ids.length], true);
    } else if (/^[1-4]$/.test(k)) { event.preventDefault(); showCat(ORDER[Number(k) - 1], true); }
    else if (k === 's') { event.preventDefault(); setTab(0, true); }
    else if (k === 'r') { event.preventDefault(); setTab(1, true); }
    else if (k === 'a') { event.preventDefault(); setTab(2, true); askInput.focus(); }
  });

  showCat('respond');

  // Lab commands join the site palette while on this page.
  const focusLab = (fn) => () => {
    lab.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    fn();
  };
  document.dispatchEvent(new CustomEvent('pb:commands', {
    detail: [
      { group: 'Product lab', label: 'Show Respond', glyph: '1', run: focusLab(() => showCat('respond', true)) },
      { group: 'Product lab', label: 'Check what I’m waiting on', glyph: '2', run: focusLab(() => showCat('waiting', true)) },
      { group: 'Product lab', label: 'Show Follow-ups', glyph: '4', run: focusLab(() => showCat('followups', true)) },
      { group: 'Product lab', label: 'Draft a reply to Maya', glyph: '✎', run: focusLab(() => { showCat('respond'); select('maya'); setTab(1, true); }) },
      { group: 'Product lab', label: 'Ask Pigeon: who hasn’t replied?', glyph: '?', run: focusLab(() => { setTab(2, true); answer(ASKS[2]); }) },
    ],
  }));
}

/* ---------------- F. Always-on city clock ---------------- */

function initCityClock() {
  const clock = $('[data-city-clock]');
  if (!clock) return;
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.textContent = `Local time ${fmt.format(new Date())}`; };
  tick();
  setInterval(tick, 30_000);
}

initGmailDemo();
initRoute();
initLab();
initCityClock();
initFlow();
