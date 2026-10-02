// Playback controls live outside the isolated, source-built extension fixture.
export function initGmailDemo() {
  const root = document.querySelector('[data-gmail-demo]');
  if (!root) return;
  const frame = root.querySelector('iframe');
  const viewport = root.querySelector('[data-demo-viewport]');
  const pause = root.querySelector('[data-demo-pause]');
  const expand = root.querySelector('[data-demo-expand]');
  const caption = root.querySelector('[data-demo-caption]');
  const progress = root.querySelector('[data-demo-progress]');
  const chapters = [...root.querySelectorAll('[data-demo-chapter]')];
  const dialog = document.querySelector('[data-demo-dialog]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const home = root.parentNode;
  const marker = document.createComment('Gmail walkthrough');
  home.insertBefore(marker, root);
  let paused = motion.matches;
  let visible = false;
  let seek;
  let current = -1;
  let playingExplicitly = false;

  const control = () => {
    frame.contentWindow?.postMessage({ type: 'pb-demo-control', paused, visible: visible || dialog.open, ...(seek !== undefined ? { seek } : {}) }, location.origin);
    seek = undefined;
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Play walkthrough' : 'Pause walkthrough');
    pause.querySelector('[data-demo-play-label]').textContent = paused ? 'Play' : 'Pause';
    root.classList.toggle('is-paused', paused);
  };
  const size = () => { frame.style.transform = `scale(${viewport.clientWidth / 1100})`; };
  new ResizeObserver(size).observe(viewport);
  size();
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'pb-demo-ready') { current = -1; control(); return; }
    if (event.data?.type !== 'pb-demo-progress') return;
    const { stage, chapter, label, progress: p } = event.data;
    if (stage !== current) {
      current = stage;
      caption.textContent = label;
      chapters.forEach((node, i) => node.classList.toggle('is-active', i === chapter));
    }
    progress.style.transform = `scaleX(${p})`;
  });
  frame.addEventListener('load', control);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; control(); }, { threshold: .15 });
  observer.observe(root);
  document.addEventListener('visibilitychange', control);
  pause.addEventListener('click', () => { paused = !paused; playingExplicitly = !paused; control(); });
  motion.addEventListener('change', () => { if (!playingExplicitly) paused = motion.matches; control(); });
  expand.addEventListener('click', () => {
    if (dialog.open) { dialog.close(); return; }
    dialog.showModal();
    dialog.append(root);
    root.classList.add('is-expanded');
    expand.setAttribute('aria-label', 'Close expanded walkthrough');
    expand.querySelector('[data-demo-expand-label]').textContent = 'Close';
    expand.focus();
    control();
  });
  dialog.addEventListener('close', () => {
    marker.after(root);
    root.classList.remove('is-expanded');
    expand.setAttribute('aria-label', 'Expand walkthrough');
    expand.querySelector('[data-demo-expand-label]').textContent = 'Expand';
    expand.focus();
    control();
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  control();
}
