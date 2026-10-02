// Data-flow tracer: highlight one kind of data across the Local and Cloud routes.
// Used on the homepage and /privacy.

const EXPLAIN = {
  raw: ['Raw mail.', 'Local: stays in your browser unless you add your own provider key. Cloud: processed for the task, never logged, not kept by default.'],
  meta: ['Metadata.', 'Senders, subjects, IDs and times. Cloud keeps it so sync and follow-ups run while Gmail is closed.'],
  derived: ['Derived intelligence.', 'Summaries, drafts and search text. Local: in your browser. Cloud: encrypted, deleted with your account.'],
  track: ['Tracking events.', 'Time, user agent and a hashed IP per open or click. Never bodies. A signal, not proof of a read.'],
};

export function initFlow() {
  document.querySelectorAll('[data-flow]').forEach((root) => {
    const flows = root.querySelector('[data-flows]');
    const explain = root.querySelector('[data-flow-explain]');
    const keys = [...root.querySelectorAll('[data-key]')];
    const initial = [...explain.childNodes].map((n) => n.cloneNode(true));
    keys.forEach((key) => key.addEventListener('click', () => {
      const on = key.getAttribute('aria-pressed') !== 'true';
      keys.forEach((k) => k.setAttribute('aria-pressed', String(on && k === key)));
      if (!on) {
        delete flows.dataset.focus;
        explain.replaceChildren(...initial.map((n) => n.cloneNode(true)));
        return;
      }
      flows.dataset.focus = key.dataset.key;
      const [title, body] = EXPLAIN[key.dataset.key];
      const strong = document.createElement('strong');
      strong.textContent = title;
      explain.replaceChildren(strong, document.createTextNode(` ${body}`));
    }));
  });
}
