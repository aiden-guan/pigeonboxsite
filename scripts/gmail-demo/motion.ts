// One action timeline owns clicks, screen changes, cursor travel, and framing.
// All positions use the recording's 1100 × 760 coordinate space.
export const CYCLE = 21000;
export const ACTIONS = [
  { id: 'read-brief', at: 800, target: 'brief', x: 930, y: 330, zoom: 1.35 },
  { id: 'open-thread', at: 2500, target: 'mail', x: 930, y: 500, zoom: 1.4 },
  { id: 'draft-reply', at: 5000, target: 'draft', x: 930, y: 560, zoom: 1.6,
    result: { after: 800, x: 470, y: 580, zoom: 1.5 }, release: 7600 },
  { id: 'ask-tab', at: 8200, target: 'ask', x: 930, y: 175, zoom: 1.35 },
  { id: 'focus-question', at: 8800, target: 'input', x: 930, y: 700, zoom: 1.6 },
  { id: 'send-question', at: 10600, target: 'submit', x: 930, y: 700, zoom: 1.65,
    result: { after: 600, x: 930, y: 370, zoom: 1.65 } },
  { id: 'open-source', at: 15800, target: 'citation', x: 930, y: 450, zoom: 1.35,
    release: 19100 },
] as const;
export const STAGES = [
  { at: 0, id: 'inbox', label: 'Find what needs a reply', chapter: 0 },
  { at: ACTIONS[0].at + 120, id: 'brief', label: 'Read the brief before opening Gmail', chapter: 0 },
  { at: ACTIONS[1].at + 120, id: 'summary', label: 'Catch up in your workspace', chapter: 1 },
  { at: ACTIONS[2].at + 120, id: 'drafting', label: 'Draft with the thread in mind', chapter: 2 },
  { at: ACTIONS[2].at + ACTIONS[2].result.after, id: 'compose', label: 'Review the reply in Gmail', chapter: 2 },
  { at: ACTIONS[3].at + 120, id: 'ask', label: 'Ask a question about your mail', chapter: 3 },
  { at: ACTIONS[5].at + ACTIONS[5].result.after, id: 'answer', label: 'Get an answer with its source', chapter: 3 },
  { at: ACTIONS[6].at + 120, id: 'source', label: 'Open the thread behind the answer', chapter: 3 },
] as const;

type CameraFrame = { at: number; zoom: number; x: number; y: number };
const wide = { zoom: 1, x: 550, y: 380 };
const CAMERA: CameraFrame[] = [{ at: 0, ...wide }];
const move = (at: number, framing: Omit<CameraFrame, 'at'>, duration = 420) => {
  CAMERA.push({ ...CAMERA[CAMERA.length - 1], at }, { ...framing, at: at + duration });
};
for (const action of ACTIONS) {
  move(action.at, action);
  if ('result' in action) move(action.at + action.result.after, action.result, 440);
  if ('release' in action) move(action.release, wide, 460);
}
CAMERA.push({ at: CYCLE, ...wide });

export function cameraAt(time: number, reduced = false) {
  if (reduced) return { zoom: 1, x: 0, y: 0 };
  let a = CAMERA[0], b = CAMERA[CAMERA.length - 1];
  for (let i = 1; i < CAMERA.length; i++) {
    if (time < CAMERA[i].at) { a = CAMERA[i - 1]; b = CAMERA[i]; break; }
    a = CAMERA[i];
  }
  const p = Math.max(0, Math.min(1, (time - a.at) / Math.max(1, b.at - a.at)));
  const ease = p * p * p * (p * (p * 6 - 15) + 10);
  const blend = (from: number, to: number) => from + (to - from) * ease;
  const clamp = (value: number, min: number) => Math.max(min, Math.min(0, value));
  const translation = (frame: CameraFrame) => ({
    x: clamp(550 - frame.x * frame.zoom, 1100 * (1 - frame.zoom)),
    y: clamp(380 - frame.y * frame.zoom, 760 * (1 - frame.zoom)),
  });
  const from = translation(a), to = translation(b);
  return { zoom: blend(a.zoom, b.zoom), x: blend(from.x, to.x), y: blend(from.y, to.y) };
}
