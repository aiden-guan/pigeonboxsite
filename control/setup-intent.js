// Someone started switching to Cloud and agreed to send mail to it. Kept for
// the trips through sign-in and Stripe checkout, so setup can finish on its
// own when they come back. Expires after a day.
const KEY = 'pigeonbox.cloudSetup';
const TTL_MS = 24 * 60 * 60 * 1000;

export function readIntent() {
  try {
    const intent = JSON.parse(localStorage.getItem(KEY) || 'null');
    return intent && Date.now() - intent.at < TTL_MS ? intent : null;
  } catch {
    return null;
  }
}

export function writeIntent() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ consent: true, at: Date.now() }));
  } catch {
    // Storage blocked: setup asks again after each trip.
  }
}

export function clearIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
