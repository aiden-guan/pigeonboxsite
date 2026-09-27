// Small live product demos inside each perch card. Each exposes start/stop and
// rests in a complete, readable state when not running.
const STOPPED = Symbol('stopped');

function runner() {
  let token = 0;
  return {
    run(fn) {
      const mine = ++token;
      const wait = (ms) => new Promise((resolve, reject) => setTimeout(() => (mine === token ? resolve() : reject(STOPPED)), ms));
      fn(wait).catch((error) => { if (error !== STOPPED) console.error(error); });
    },
    stop() { token++; },
  };
}

async function typeInto(node, text, wait, speed = 22) {
  node.textContent = '';
  for (let i = 0; i < text.length; i++) {
    node.textContent += text[i];
    const ch = text[i];
    await wait(ch === ',' || ch === '.' ? speed * 6 : ch === ' ' ? speed * 1.4 : speed);
  }
}

function sortDemo(el) {
  const rows = [...el.querySelectorAll('.sort-list li')];
  const tabs = [...el.querySelectorAll('.sort-tab')];
  const fresh = rows.find((r) => r.classList.contains('is-new'));
  const r = runner();
  const count = (cat) => rows.filter((row) => row.dataset.cat === cat && row.classList.contains('is-sorted') && (!row.classList.contains('is-new') || row.classList.contains('is-arrived'))).length;
  const renderCounts = (bumpCat) => {
    for (const tab of tabs) {
      const b = tab.querySelector('b');
      const n = String(count(tab.dataset.cat));
      if (b.textContent !== n) {
        b.textContent = n;
        if (tab.dataset.cat === bumpCat) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
      }
    }
  };
  const filter = (cat) => {
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.cat === cat));
    for (const row of rows) row.classList.toggle('is-hidden', Boolean(cat) && row.dataset.cat !== cat);
  };
  const finalState = () => {
    fresh?.classList.add('is-arrived');
    rows.forEach((row) => row.classList.add('is-sorted'));
    filter(null);
    renderCounts();
  };
  finalState();
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    r.stop();
    el.classList.remove('is-scanning');
    finalState();
    filter(tab.getAttribute('aria-pressed') === 'true' ? null : tab.dataset.cat);
  }));
  return {
    start() {
      r.run(async (wait) => {
        for (;;) {
          filter(null);
          fresh?.classList.remove('is-arrived');
          rows.forEach((row) => row.classList.remove('is-sorted'));
          renderCounts();
          await wait(650);
          el.classList.add('is-scanning');
          for (const row of rows) {
            if (row === fresh) continue;
            await wait(430);
            row.classList.add('is-sorted');
            renderCounts(row.dataset.cat);
          }
          el.classList.remove('is-scanning');
          await wait(900);
          if (fresh) {
            fresh.classList.add('is-arrived');
            await wait(700);
            fresh.classList.add('is-sorted');
            renderCounts('respond');
            await wait(1100);
          }
          for (const cat of ['respond', 'waiting', 'fyi', 'note']) {
            filter(cat);
            await wait(1700);
          }
          filter(null);
          await wait(2400);
        }
      });
    },
    stop() { r.stop(); el.classList.remove('is-scanning'); finalState(); },
  };
}

function summaryDemo(el) {
  const r = runner();
  const bits = [...el.querySelectorAll('.summary li, .summary dl > div')];
  const finalState = () => { el.classList.add('is-open'); bits.forEach((b) => b.classList.add('is-in')); };
  finalState();
  const play = () => r.run(async (wait) => {
    el.classList.remove('is-open');
    bits.forEach((b) => b.classList.remove('is-in'));
    await wait(1400);
    el.classList.add('is-open');
    await wait(500);
    for (const b of bits) { b.classList.add('is-in'); await wait(380); }
  });
  el.querySelector('.demo-replay')?.addEventListener('click', play);
  return { start: play, stop() { r.stop(); finalState(); } };
}

const DRAFTS = {
  warm: 'Hi Maya, thanks for the clear notes! I’ll soften the opening line and swap in the new screenshot, then send the revised version ahead of Friday’s review.\nBest, Alex',
  brief: 'Hi Maya — will do. Softer opener and a new screenshot; revised note to you before Friday.\nAlex',
  formal: 'Hello Maya,\nThank you for the feedback. I will revise the opening line and replace the screenshot, and I will circulate the updated note before Friday’s review.\nKind regards, Alex',
};

function draftDemo(el) {
  const r = runner();
  const body = el.querySelector('.compose-body');
  const buttons = [...el.querySelectorAll('[data-tone]')];
  let current = 'warm';
  const press = (tone) => { current = tone; buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tone === tone))); };
  const finalState = () => { el.classList.remove('is-typing'); body.textContent = DRAFTS[current]; };
  finalState();
  const write = (tone, loop) => r.run(async (wait) => {
    let order = ['warm', 'brief', 'formal'];
    let i = order.indexOf(tone);
    do {
      press(order[i]);
      el.classList.add('is-typing');
      body.textContent = '';
      await wait(420);
      await typeInto(body, DRAFTS[order[i]], wait, 19);
      el.classList.remove('is-typing');
      await wait(2600);
      i = (i + 1) % order.length;
    } while (loop);
  });
  buttons.forEach((b) => b.addEventListener('click', () => write(b.dataset.tone, false)));
  return { start: () => write(current, true), stop() { r.stop(); finalState(); } };
}

const QUESTIONS = [
  { q: 'What did Maya need for Friday?', a: 'Maya asked for a softer opening line and a screenshot from the new build before Friday’s 10:00 review.', s: 'Final review on the launch note · Maya Chen' },
  { q: 'Where are the design files?', a: 'Alex put them in the shared folder for tomorrow’s review and asked everyone to add comments there.', s: 'Design files for tomorrow · Alex Rivera' },
  { q: 'Did Jules confirm the handoff?', a: 'Not yet. Jules asked you to confirm the latest version, and there’s no reply in the thread.', s: 'Re: September handoff · Jules Turner' },
];

function askDemo(el) {
  const r = runner();
  const q = el.querySelector('.ask-q'), a = el.querySelector('.ask-text'), s = el.querySelector('.source-name');
  const buttons = [...el.querySelectorAll('[data-q]')];
  let index = 0;
  const show = (i) => { index = i; buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.q) === i))); };
  const finalState = () => { el.classList.remove('is-typing', 'is-thinking', 'is-waiting'); const item = QUESTIONS[index]; q.textContent = item.q; a.textContent = item.a; s.textContent = item.s; show(index); };
  finalState();
  const ask = (start, loop) => r.run(async (wait) => {
    let i = start;
    do {
      const item = QUESTIONS[i];
      show(i);
      el.classList.add('is-typing', 'is-waiting');
      a.textContent = '';
      await typeInto(q, item.q, wait, 34);
      el.classList.remove('is-typing');
      el.classList.add('is-thinking');
      await wait(900);
      el.classList.remove('is-thinking');
      const words = item.a.split(' ');
      for (let w = 0; w < words.length; w++) { a.textContent = words.slice(0, w + 1).join(' '); await wait(55); }
      s.textContent = item.s;
      el.classList.remove('is-waiting');
      await wait(3200);
      i = (i + 1) % QUESTIONS.length;
    } while (loop);
  });
  buttons.forEach((b) => b.addEventListener('click', () => ask(Number(b.dataset.q), false)));
  return { start: () => ask(index, true), stop() { r.stop(); finalState(); } };
}

function trackDemo(el) {
  const r = runner();
  const events = [...el.querySelectorAll('.track-events li')];
  const status = el.querySelector('.track-status');
  const labels = ['Sent', 'Opened', 'Clicked', 'Opened 2×'];
  const finalState = () => { events.forEach((e) => e.classList.add('is-in')); status.textContent = labels[3]; status.classList.remove('is-sent'); };
  finalState();
  return {
    start() {
      r.run(async (wait) => {
        for (;;) {
          events.forEach((e) => e.classList.remove('is-in'));
          status.textContent = 'Sent';
          status.classList.add('is-sent');
          await wait(500);
          for (let i = 0; i < events.length; i++) {
            events[i].classList.add('is-in');
            status.textContent = labels[i];
            status.classList.toggle('is-sent', i === 0);
            await wait(i === 0 ? 1300 : 1500);
          }
          await wait(3200);
        }
      });
    },
    stop() { r.stop(); finalState(); },
  };
}

const FACTORIES = { sort: sortDemo, summary: summaryDemo, draft: draftDemo, ask: askDemo, track: trackDemo };

export function initDemos() {
  const map = new Map();
  document.querySelectorAll('[data-demo]').forEach((el) => {
    const make = FACTORIES[el.dataset.demo];
    if (make) map.set(el.closest('[data-stop]'), make(el));
  });
  return map;
}
