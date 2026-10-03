// Small DOM toolkit for the control plane. Everything user- or mail-derived is
// set as text (never HTML), so nothing from an email can run in this page.

const SAFE_HREF = /^(?:\/(?!\/)|https:\/\/|mailto:|#[a-z][a-z0-9/-]*$)/i;

/**
 * h('button', { class: 'x', on: { click } }, 'Label', child, [more])
 * Props: class, text, on, attrs (any attribute), dataset, and common
 * properties (id, type, value, checked, disabled, hidden, name, placeholder…).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'on') for (const [event, handler] of Object.entries(value)) el.addEventListener(event, handler);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'attrs') for (const [name, attr] of Object.entries(value)) attr !== undefined && attr !== null && attr !== false && el.setAttribute(name, attr === true ? '' : String(attr));
    else if (key === 'href') el.setAttribute('href', SAFE_HREF.test(String(value)) ? String(value) : '#');
    else if (key in el) el[key] = value;
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function ago(iso) {
  if (!iso) return '—';
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const units = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return Math.abs(seconds) < 45 ? 'just now' : relative.format(Math.round(seconds / 60), 'minute');
}

export function when(iso, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return iso ? new Intl.DateTimeFormat(undefined, options).format(new Date(iso)) : '—';
}

export const day = (iso) => when(iso, { dateStyle: 'medium' });
export const plural = (n, word, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;
export const humanize = (value) => String(value ?? '').replace(/_/g, ' ');
export const key = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

let toastRoot = null;

export function toast(message, tone = 'info') {
  toastRoot ??= document.getElementById('toasts');
  if (!toastRoot) return;
  const item = h('div', { class: ['toast', `toast-${tone}`], attrs: { role: tone === 'error' ? 'alert' : 'status' } }, message);
  toastRoot.append(item);
  setTimeout(() => item.classList.add('leaving'), 4_200);
  setTimeout(() => item.remove(), 4_700);
}

/** A button that runs an async action, shows progress, and reports failures. */
export function button(label, action, { variant = 'primary', busy = 'Working…', title, disabled = false, small = false } = {}) {
  const el = h('button', { type: 'button', class: ['btn', `btn-${variant}`, small && 'btn-small'], title, disabled }, label);
  el.addEventListener('click', async (event) => {
    event.preventDefault();
    if (el.disabled) return;
    const original = el.textContent;
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    el.textContent = busy;
    try {
      await action(event);
    } catch (error) {
      toast(error?.message || 'Something went wrong.', 'error');
    } finally {
      if (el.isConnected) {
        el.disabled = false;
        el.removeAttribute('aria-busy');
        el.textContent = original;
      }
    }
  });
  return el;
}

export function link(label, href, props = {}) {
  return h('a', { href, ...props }, label);
}

export function pill(text, tone = 'neutral') {
  return h('span', { class: ['pill', `pill-${tone}`] }, text);
}

export function chips(values, tone = 'neutral') {
  return h('div', { class: 'chips' }, values.map((value) => pill(humanize(value), tone)));
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h2', {}, title) : null, ...children);
}

export function empty(text, ...actions) {
  return h('div', { class: 'empty' }, h('p', {}, text), actions.length ? h('div', { class: 'row' }, actions) : null);
}

export function note(text, tone = 'info') {
  return h('p', { class: ['note', `note-${tone}`], attrs: { role: tone === 'error' ? 'alert' : null } }, text);
}

export function loading(text = 'Loading…') {
  return h('p', { class: 'loading', attrs: { role: 'status' } }, text);
}

export function stat(label, value, detail, href) {
  const body = [h('span', { class: 'stat-label' }, label), h('strong', { class: 'stat-value' }, value), detail ? h('span', { class: 'stat-detail' }, detail) : null];
  return href ? h('a', { class: 'stat', href }, body) : h('div', { class: 'stat' }, body);
}

export function table(columns, rows, { emptyText = 'Nothing yet.' } = {}) {
  if (!rows.length) return empty(emptyText);
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, columns.map((column) => h('th', { attrs: { scope: 'col' }, class: column.numeric ? 'num' : null }, column.label)))),
      h('tbody', {}, rows.map((row) => h('tr', {}, columns.map((column) => h('td', { class: column.numeric ? 'num' : null }, column.render(row)))))),
    ),
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

let fieldId = 0;

export function field(label, control, hint) {
  const id = control.id || `f${(fieldId += 1)}`;
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('p', { class: 'hint' }, hint) : null);
}

export function input(props = {}) {
  return h('input', { type: 'text', class: 'input', ...props });
}

export function textarea(props = {}) {
  return h('textarea', { class: 'input', rows: 4, ...props });
}

export function select(options, value, props = {}) {
  return h(
    'select',
    { class: 'input', ...props },
    options.map(([optionValue, label]) => h('option', { value: optionValue, selected: String(optionValue) === String(value) }, label)),
  );
}

export function checkbox(label, checked, props = {}, hint) {
  const box = h('input', { type: 'checkbox', checked, ...props });
  return h('label', { class: 'check' }, box, h('span', {}, label, hint ? h('small', {}, hint) : null));
}

/** A switch that saves itself; reverts and reports if saving fails. */
export function toggle(label, checked, onChange, hint) {
  const box = h('input', { type: 'checkbox', class: 'switch', checked, attrs: { role: 'switch' } });
  box.addEventListener('change', async () => {
    box.disabled = true;
    try {
      await onChange(box.checked);
    } catch (error) {
      box.checked = !box.checked;
      toast(error?.message || 'Could not save.', 'error');
    } finally {
      box.disabled = false;
    }
  });
  return h('label', { class: 'toggle' }, h('span', {}, label, hint ? h('small', {}, hint) : null), box);
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

/**
 * Ask before something consequential. With `typed`, the person must type the
 * phrase to enable the confirm button. Resolves to true or false.
 */
export function confirmDialog({ title, body, confirm = 'Confirm', danger = false, typed = null, extra = null, cancellable = true }) {
  return new Promise((resolve) => {
    const phrase = typed ? input({ autocomplete: 'off', attrs: { 'aria-label': `Type ${typed} to confirm` } }) : null;
    const ok = h('button', { type: 'submit', class: ['btn', danger ? 'btn-danger' : 'btn-primary'], disabled: Boolean(typed) }, confirm);
    const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancel');
    const dialog = h(
      'dialog',
      { class: 'dialog', attrs: { 'aria-labelledby': 'dialog-title' } },
      h(
        'form',
        { method: 'dialog' },
        h('h2', { id: 'dialog-title' }, title),
        (Array.isArray(body) ? body : [body]).map((line) => (line instanceof Node ? line : h('p', {}, line))),
        extra,
        typed ? field(`Type “${typed}” to confirm`, phrase) : null,
        h('div', { class: 'row end' }, cancellable ? cancel : null, ok),
      ),
    );
    phrase?.addEventListener('input', () => (ok.disabled = phrase.value.trim() !== typed));
    cancel.addEventListener('click', () => dialog.close('cancel'));
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    ok.addEventListener('click', (event) => {
      event.preventDefault();
      dialog.close('ok');
    });
    document.body.append(dialog);
    dialog.showModal();
    (phrase ?? ok).focus();
  });
}

/** Show a secret once, with a copy button. */
export function secretDialog(title, secret, lines = [], extra = null) {
  const value = h('code', { class: 'secret' }, secret);
  const copy = button('Copy', () => copyText(secret), { variant: 'ghost', small: true, busy: 'Copying…' });
  return confirmDialog({ title, body: [...lines, h('div', { class: 'secret-row' }, value, copy)], confirm: 'Done', extra, cancellable: false });
}

export async function copyText(text, message = 'Copied.') {
  try {
    await navigator.clipboard.writeText(text);
    toast(message, 'success');
  } catch {
    throw new Error('Your browser blocked copying. Select the text and copy it instead.');
  }
}

/** Tabs within a section. `tabs` is [[id, label, render]]. */
export function tabs(items, initial = items[0][0]) {
  const panel = h('div', { class: 'tab-panel' });
  const buttons = items.map(([id, label]) =>
    h('button', { type: 'button', class: 'tab', attrs: { role: 'tab', 'aria-selected': id === initial ? 'true' : 'false' }, dataset: { tab: id } }, label),
  );
  const bar = h('div', { class: 'tabs', attrs: { role: 'tablist' } }, buttons);
  const show = async (id) => {
    for (const el of buttons) el.setAttribute('aria-selected', el.dataset.tab === id ? 'true' : 'false');
    clear(panel, loading());
    try {
      clear(panel, await items.find(([itemId]) => itemId === id)[2]());
    } catch (error) {
      clear(panel, note(error?.message || 'Could not load this.', 'error'));
    }
  };
  for (const el of buttons) el.addEventListener('click', () => show(el.dataset.tab));
  show(initial);
  return h('div', {}, bar, panel);
}

/** Label/value pairs as a responsive grid. `pairs` is [[label, value]]. */
export function facts(pairs) {
  return h('dl', { class: 'facts' }, pairs.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))));
}
