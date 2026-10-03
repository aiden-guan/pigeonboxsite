import { loadSiteConfig } from './app.js';
import { startStage } from './waitlist-stage.js?v=8';

const stage = startStage();

const form = document.querySelector('#waitlist-form');
const email = document.querySelector('#waitlist-email');
const status = document.querySelector('#waitlist-status');
const button = form.querySelector('button[type=submit]');
const source = new URLSearchParams(location.search).get('source') === 'extension' ? 'extension' : 'website';
let submitting = false;

email.addEventListener('input', () => { email.removeAttribute('aria-invalid'); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting) return;
  email.value = email.value.trim();
  if (!email.checkValidity()) {
    email.setAttribute('aria-invalid', 'true');
    status.dataset.state = 'error';
    status.textContent = 'Enter a valid email address to join.';
    stage?.shake();
    email.focus();
    return;
  }
  submitting = true;
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  button.textContent = 'Joining…';
  stage?.hop();
  status.dataset.state = 'pending';
  status.textContent = 'Saving your place…';
  try {
    const { waitlistApiUrl } = await loadSiteConfig();
    if (!waitlistApiUrl) throw new Error('unconfigured');
    const response = await fetch(waitlistApiUrl, {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, source, website: form.elements.website.value }),
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 429) throw new Error('rate_limited');
    if (!response.ok || (await response.json()).ok !== true) throw new Error('not_saved');
    status.dataset.state = 'success';
    status.textContent = 'You’re on the list. Thanks for coming along.';
    button.textContent = 'You’re on the list ✓';
    email.readOnly = true;
    stage?.deliver();
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = error.message === 'rate_limited' ? 'Too many attempts. Wait a minute, then try again.' : 'We couldn’t save your place. Your email is still here—please try again.';
    button.textContent = 'Try again';
    stage?.shake();
    button.disabled = false;
  } finally {
    submitting = false;
    form.removeAttribute('aria-busy');
  }
});
