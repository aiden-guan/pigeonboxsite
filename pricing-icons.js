// Small, separate actors give each halftone icon a feature-specific story.
// Only the hovered icon runs; its dots settle back on exit.
const ease = 'cubic-bezier(.45,0,.25,1)';
const pose = (offset, transform = 'none', opacity = 1) => ({ offset, transform, opacity });
const gesture = (transform, opacity = 1) => [pose(0), pose(.18), pose(.42, transform, opacity), pose(.72), pose(1)];
const pulse = scale => gesture(`scale(${scale})`);

const stories = {
  connection: [
    ['left', gesture('translate(-2px,-2px)')],
    ['right', gesture('translate(2px,2px)')],
    ['bridge', gesture('scale(.85)', .4)],
  ],
  sync: [
    ['arrows', [pose(0), pose(.12), pose(.78, 'rotate(360deg)'), pose(1, 'rotate(360deg)')]],
    ['flap', gesture('translateY(-1.5px)')],
  ],
  analysis: [
    ['lens', [pose(0), pose(.15), pose(.32, 'translate(-3px,-4px)'), pose(.52, 'translate(1px,-4px)'), pose(.76), pose(1)]],
    ['page', gesture('none', .7)],
  ],
  focus: [
    ['outer', gesture('rotate(90deg)')],
    ['target', pulse(.84)],
    ['core', pulse(1.2)],
  ],
  ai: [
    ['top', gesture('translateY(-1px)', .4)],
    ['right', gesture('translateX(1px)', .4), { delay: 110 }],
    ['bottom', gesture('translateY(1px)', .4), { delay: 220 }],
    ['left', gesture('translateX(-1px)', .4), { delay: 330 }],
    ['core', pulse(1.12)],
  ],
  drafts: [
    ['pencil', [pose(0), pose(.12), pose(.28, 'translate(1.5px,-1.5px) rotate(-6deg)'), pose(.42, 'translate(-1px,1px) rotate(3deg)'), pose(.56, 'translate(1px,-1px) rotate(-3deg)'), pose(.75), pose(1)], { origin: '21px 15px' }],
    ['writing', [pose(0), pose(.16, 'none', .35), pose(.55), pose(1)]],
  ],
  approval: [
    ['ring', pulse(1.05)],
    ['check', [
      { offset: 0, clipPath: 'inset(0 0 0 0)' },
      { offset: .12, clipPath: 'inset(0 100% 0 0)' },
      { offset: .48, clipPath: 'inset(0 0 0 0)' },
      { offset: 1, clipPath: 'inset(0 0 0 0)' },
    ]],
  ],
  ask: [
    ['dot1', gesture('translateY(-2px)'), { delay: 0 }],
    ['dot2', gesture('translateY(-2px)'), { delay: 140 }],
    ['dot3', gesture('translateY(-2px)'), { delay: 280 }],
  ],
  reminders: [
    ['bell', [pose(0), pose(.12, 'rotate(-12deg)'), pose(.23, 'rotate(10deg)'), pose(.34, 'rotate(-7deg)'), pose(.44, 'rotate(4deg)'), pose(.56), pose(1)], { origin: '16px 5px' }],
    ['clapper', [pose(0), pose(.12, 'translateX(1.5px)'), pose(.23, 'translateX(-1.2px)'), pose(.34, 'translateX(.8px)'), pose(.56), pose(1)]],
  ],
  briefings: [
    ['page', gesture('translateY(-2px)')],
    ['lines', gesture('translateY(-2px)', .65)],
    ['back', gesture('rotate(-3deg)')],
  ],
  activity: [
    ['bar1', gesture('scaleY(.45)'), { origin: '10px 25px' }],
    ['bar2', gesture('scaleY(.65)'), { origin: '17px 25px', delay: 130 }],
    ['bar3', gesture('scaleY(.3)'), { origin: '24px 25px', delay: 260 }],
  ],
  calendar: [
    ['date1', pulse(1.25), { origin: '11px 18px' }],
    ['date2', pulse(1.25), { origin: '17px 18px', delay: 100 }],
    ['date3', pulse(1.25), { origin: '23px 18px', delay: 200 }],
    ['date5', [pose(0), pose(.22, 'none', 0), pose(.62, 'none', 0), pose(.82), pose(1)]],
    ['accent', [pose(0, 'scale(.85)', 0), pose(.22, 'scale(.85)', 0), pose(.42), pose(.62), pose(.82, 'none', 0), pose(1, 'none', 0)]],
  ],
  relationships: [
    ['hub', pulse(1.1), { origin: '16px 7px' }],
    ['left', gesture('translate(1px,-1.5px)')],
    ['right', gesture('translate(-1px,-1.5px)')],
    ['links', gesture('none', .4)],
  ],
  views: [
    ['eye', [pose(0), pose(.12), pose(.23, 'scaleY(.2)'), pose(.33), pose(1)]],
    ['iris', [pose(0), pose(.12), pose(.23, 'scaleY(.2)', 0), pose(.33), pose(.52, 'translateX(2px)'), pose(.68, 'translateX(-2px)'), pose(.85), pose(1)]],
  ],
  automations: [
    ['bolt', [pose(0), pose(.17, 'scale(.96)', .6), pose(.3, 'scale(1.07)'), pose(.55), pose(1)]],
    ['accent', [pose(0, 'scale(.85)', 0), pose(.17, 'scale(.85)', 0), pose(.32, 'scale(1.05)', 1), pose(.55, 'scale(1.2)', 0), pose(1, 'none', 0)]],
  ],
  tracking: [
    ['sweep', [pose(0), pose(1, 'rotate(360deg)')], { duration: 3000, easing: 'linear' }],
    ['blip1', gesture('scale(1.2)', .35), { origin: '10px 17px', delay: 300 }],
    ['blip2', gesture('scale(1.2)', .35), { origin: '22px 22px', delay: 850 }],
  ],
  teams: [
    ['head1', gesture('translate(1px,1px)')],
    ['head2', gesture('translate(-1px,1px)'), { delay: 120 }],
    ['people', pulse(1.025), { origin: '16px 27px' }],
  ],
  api: [
    ['left', gesture('translateX(-1.5px)')],
    ['right', gesture('translateX(1.5px)')],
    ['slash', [pose(0), pose(.18, 'none', .25), pose(.58, 'none', .25), pose(.8), pose(1)]],
    ['accent', [pose(0, 'translateX(-4px)', 0), pose(.18, 'translateX(-4px)', 0), pose(.3, 'translateX(-2px)'), pose(.55, 'translateX(4px)'), pose(.7, 'translateX(5px)', 0), pose(1, 'none', 0)]],
  ],
};

export function initFeatureIcons(list, reducedMotion, finePointer) {
  const nodes = [...list.querySelectorAll('.orbit-feature')];
  const actors = new Map();
  let ready = false, active = null;

  function stop(immediate = false) {
    const node = active;
    active = null;
    if (node) delete node.dataset.iconActive;
    for (const [part, animation] of actors) {
      const current = getComputedStyle(part);
      const from = { transform: current.transform, opacity: current.opacity, clipPath: current.clipPath };
      animation.cancel();
      if (!immediate && !reducedMotion.matches && !list.hidden) {
        const settle = part.animate([from, {
          transform: 'none', opacity: part.dataset.iconRestOpacity || '1', clipPath: from.clipPath === 'none' ? 'none' : 'inset(0 0 0 0)',
        }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
        actors.set(part, settle);
      } else actors.delete(part);
    }
  }

  function play(node) {
    if (active === node || !ready || reducedMotion.matches || list.hidden || document.hidden) return;
    stop(true);
    active = node;
    node.dataset.iconActive = 'true';
    const icon = node.querySelector('.feature-icon');
    for (const [name, frames, options = {}] of stories[icon.dataset.iconName] || []) {
      const part = icon.querySelector(`[data-icon-part="${name}"]`);
      if (!part) continue;
      const { origin = '16px 16px', ...timing } = options;
      part.style.transformOrigin = origin;
      actors.set(part, part.animate(frames, {
        duration: 2400, iterations: Infinity, easing: ease, ...timing,
      }));
    }
  }

  // External symbols provide the static/no-JS fallback. Clone their dot actors
  // locally so animations address real SVG groups without shadow-tree selectors.
  fetch('/brand/feature-icons.svg?v=2')
    .then(response => {
      if (!response.ok) throw new Error('Feature icon artwork unavailable');
      return response.text();
    })
    .then(source => {
      const sprite = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (sprite.querySelector('parsererror')) return;
      nodes.forEach(node => {
        const icon = node.querySelector('.feature-icon');
        const name = icon.querySelector('use')?.getAttribute('href').split('#')[1];
        const symbol = sprite.getElementById(name);
        if (!symbol || !stories[name]) return;
        icon.replaceChildren(...[...symbol.children].map(child => document.importNode(child, true)));
        icon.dataset.iconName = name;
      });
      ready = true;
      list.dataset.featureIconsReady = 'true';
      const hovered = nodes.find(node => node.matches(':hover'));
      if (hovered && finePointer.matches) play(hovered);
    })
    .catch(() => { /* The external SVG remains a complete static fallback. */ });

  nodes.forEach(node => {
    node.addEventListener('pointerenter', event => {
      if (finePointer.matches && event.pointerType !== 'touch') play(node);
    });
    node.addEventListener('pointerleave', () => { if (active === node) stop(); });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(true); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stop(true); });
  return { stop: () => stop(true) };
}
