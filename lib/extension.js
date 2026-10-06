// The PigeonBox extension in this browser, reached through Chrome's
// externally_connectable messaging. The extension only answers this site's
// origins, never returns secrets, and asks for Chrome permissions on its own
// pages. Without the extension (another browser, not installed) everything
// here resolves to null and the dashboard shows Cloud account pages only.

/** Chrome Web Store item, then unpacked builds allowed by the Cloud API. */
export const STORE_ID = 'hmoiiokfmacghpddabpgaajolbeljhcp';
export const STORE_URL = `https://chromewebstore.google.com/detail/${STORE_ID}`;
const KNOWN_IDS = [STORE_ID, 'dkjdlhfabppgpmajibbpnoibpcbedkig', 'pidbobigaeefgpjjjmglfipkkollgbcl'];
const ID_KEY = 'pigeonbox.extension';
const ID_PATTERN = /^[a-p]{32}$/;
const TIMEOUT_MS = 5_000;

let extensionId = null;

function remembered() {
  try {
    const value = localStorage.getItem(ID_KEY);
    return ID_PATTERN.test(value ?? '') ? value : null;
  } catch {
    return null;
  }
}

function remember(id) {
  try {
    localStorage.setItem(ID_KEY, id);
  } catch {
    // Storage blocked: the ID comes from the address next time.
  }
}

function runtime() {
  return globalThis.chrome?.runtime?.sendMessage ? globalThis.chrome.runtime : null;
}

/** One message to one extension ID. Resolves to the reply, or null if nobody answered. */
function sendTo(id, message, timeout = TIMEOUT_MS) {
  const rt = runtime();
  if (!rt) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    try {
      rt.sendMessage(id, message, (reply) => {
        clearTimeout(timer);
        // Reading lastError marks it handled; a missing extension lands here.
        resolve(rt.lastError ? null : reply ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Find the extension. The extension opens this page with `?ext=<its ID>`;
 * otherwise try the remembered ID and the known builds. Resolves to its HELLO
 * reply ({ extensionId, version, product, apiBaseUrl, … }) or null. HELLO
 * also tells the extension which tab to reuse for Settings; BYE on leaving
 * tells it to stop.
 */
export async function findExtension(hintedId = null) {
  if (!runtime()) return null;
  const candidates = [...new Set([hintedId, remembered(), ...KNOWN_IDS].filter((id) => ID_PATTERN.test(id ?? '')))];
  for (const id of candidates) {
    const hello = await sendTo(id, { type: 'HELLO' }, id === hintedId ? TIMEOUT_MS : 1_500);
    if (hello?.ok) {
      if (!extensionId) addEventListener('pagehide', () => void sendTo(extensionId, { type: 'BYE' }, 500));
      extensionId = id;
      remember(id);
      return hello;
    }
  }
  return null;
}

/** A request to the extension found by findExtension. Throws a readable error when it fails. */
export async function ext(type, body = {}) {
  if (!extensionId) throw new Error('PigeonBox is not installed in this browser, or it needs an update.');
  const reply = await sendTo(extensionId, { type, ...body }, type === 'ACTION' ? 60_000 : 15_000);
  if (!reply) throw new Error('PigeonBox did not answer. Reload this page, or reload PigeonBox on chrome://extensions.');
  if (reply.ok === false) throw new Error(reply.reason || 'PigeonBox could not do that.');
  return reply;
}

export const hasExtension = () => Boolean(extensionId);
