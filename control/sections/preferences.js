import { button, card, checkbox, field, h, input, select, toast } from '../ui.js';

const DAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
];
const DRAFT_KINDS = [
  ['reply', 'Replies'],
  ['follow_up', 'Follow-ups'],
  ['scheduling', 'Scheduling replies'],
  ['acknowledgment', 'Acknowledgments'],
  ['info_request', 'Requests for missing information'],
];

const checked = (row) => row.querySelector('input').checked;
const time = (value) => input({ type: 'time', value, required: true });
const number = (value, min, max) => input({ type: 'number', value, min, max });

function zones(current) {
  let list = [];
  try {
    list = Intl.supportedValuesOf('timeZone');
  } catch {
    list = [current, 'UTC'];
  }
  if (!list.includes(current)) list.unshift(current);
  return list.map((zone) => [zone, zone.replace(/_/g, ' ')]);
}

export async function render({ api }) {
  const { preferences: p } = await api('/v1/preferences');

  const zone = select(zones(p.timeZone), p.timeZone);
  const workdays = DAYS.map(([value, label]) => checkbox(label, p.workdays.includes(value), { value }));
  const workStart = time(p.workingHours.start);
  const workEnd = time(p.workingHours.end);

  const followDays = number(p.followUp.defaultBusinessDays, 1, 30);
  const remindOpened = checkbox('Remind me when they opened but did not reply', p.followUp.remindIfOpenedNoReply);
  const remindRevived = checkbox('Tell me when an old thread comes back to life', p.followUp.remindWhenRevived);
  const morningDraft = checkbox('Prepare follow-up drafts the morning they are due', p.followUp.prepareDraftMorningOf);
  const morningAt = time(p.followUp.morningAt);

  const draftsOn = checkbox('Prepare drafts in the background', p.autoDrafts.enabled, {}, 'Drafts are grounded in the thread; missing facts become placeholders.');
  const placeInGmail = checkbox('Also put them in Gmail as drafts', p.autoDrafts.placeInGmail, {}, 'Needs the “Create drafts” permission. PigeonBox never overwrites a draft you edited.');
  const learn = checkbox('Learn from how I edit drafts', p.autoDrafts.learnFromEdits, {}, 'Only structure (length, greeting, sign-off) is kept. Your text is never stored.');
  const kinds = DRAFT_KINDS.map(([value, label]) => checkbox(label, p.autoDrafts.kinds.includes(value), { value }));

  const buffer = number(p.calendar.bufferMinutes, 0, 120);
  const duration = number(p.calendar.defaultDurationMinutes, 5, 480);
  const backToBack = checkbox('Avoid back-to-back meetings', p.calendar.avoidBackToBack);
  const mornings = checkbox('Prefer mornings', p.calendar.preferMornings);

  const morningOn = checkbox('Morning briefing on workdays', p.briefings.morning.enabled);
  const morningTime = time(p.briefings.morning.at);
  const eodOn = checkbox('End-of-day wrap-up', p.briefings.endOfDay.enabled);
  const eodTime = time(p.briefings.endOfDay.at);
  const meetingOn = checkbox('Brief me before meetings', p.briefings.meeting.enabled);
  const meetingBefore = number(p.briefings.meeting.minutesBefore, 5, 240);
  const externalOnly = checkbox('Only meetings with people outside my company', p.briefings.meeting.externalOnly);

  const notify = {
    extension: checkbox('In the PigeonBox extension', p.notifications.extension),
    web: checkbox('In this web app', p.notifications.web),
    followUpsDue: checkbox('Follow-ups due', p.notifications.followUpsDue),
    approvals: checkbox('Approvals waiting', p.notifications.approvals),
    engagement: checkbox('Engagement (opens, clicks, document views)', p.notifications.engagement),
  };
  const web = checkbox('Allow web research for drafts and Ask Pigeon', p.webResearch, {}, 'Off by default. Only your question is sent to the search provider, never email content.');

  const save = button('Save preferences', async () => {
    const days = workdays.filter(checked).map((row) => Number(row.querySelector('input').value));
    if (!days.length) throw new Error('Choose at least one working day.');
    if (workStart.value >= workEnd.value) throw new Error('Working hours must end after they start.');
    const draftKinds = kinds.filter(checked).map((row) => row.querySelector('input').value);
    await api('/v1/preferences/update', {
      method: 'POST',
      body: {
        preferences: {
          timeZone: zone.value,
          workdays: days,
          workingHours: { start: workStart.value, end: workEnd.value },
          followUp: { defaultBusinessDays: Number(followDays.value), remindIfOpenedNoReply: checked(remindOpened), remindWhenRevived: checked(remindRevived), prepareDraftMorningOf: checked(morningDraft), morningAt: morningAt.value },
          autoDrafts: { enabled: checked(draftsOn), placeInGmail: checked(placeInGmail), learnFromEdits: checked(learn), kinds: draftKinds },
          calendar: { bufferMinutes: Number(buffer.value), defaultDurationMinutes: Number(duration.value), avoidBackToBack: checked(backToBack), preferMornings: checked(mornings) },
          briefings: {
            morning: { enabled: checked(morningOn), at: morningTime.value },
            endOfDay: { enabled: checked(eodOn), at: eodTime.value },
            meeting: { enabled: checked(meetingOn), minutesBefore: Number(meetingBefore.value), externalOnly: checked(externalOnly) },
          },
          notifications: Object.fromEntries(Object.entries(notify).map(([name, row]) => [name, checked(row)])),
          webResearch: checked(web),
        },
      },
    });
    toast('Preferences saved.', 'success');
  }, { busy: 'Saving…' });

  return h(
    'form',
    { class: 'stack', on: { submit: (event) => event.preventDefault() } },
    card('Your working week', field('Time zone', zone), h('div', { class: 'checks inline', attrs: { role: 'group', 'aria-label': 'Working days' } }, workdays), h('div', { class: 'grid-2' }, field('Day starts', workStart), field('Day ends', workEnd))),
    card('Follow-ups', field('Default wait (business days)', followDays), remindOpened, remindRevived, morningDraft, field('Morning prep time', morningAt), h('p', { class: 'hint' }, 'PigeonBox reminds you and prepares a draft. It never sends a follow-up for you.')),
    card('Background drafts', draftsOn, placeInGmail, learn, h('div', { class: 'checks', attrs: { role: 'group', 'aria-label': 'Draft kinds' } }, kinds)),
    card('Calendar', h('div', { class: 'grid-2' }, field('Buffer between meetings (minutes)', buffer), field('Default meeting length (minutes)', duration)), backToBack, mornings),
    card('Briefings', morningOn, field('Morning briefing at', morningTime), eodOn, field('Wrap-up at', eodTime), meetingOn, field('Minutes before a meeting', meetingBefore), externalOnly),
    card('Notifications', Object.values(notify)),
    card('Web research', web),
    h('div', { class: 'row sticky-actions' }, save),
  );
}
