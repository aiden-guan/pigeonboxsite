const messages = {
  maya: {
    category: 'respond', initials: 'MC', avatar: 'avatar-lilac', from: 'Maya Chen', time: '9:42 AM',
    subject: 'Final review on the launch note', snippet: 'Could you soften the opening and update the screenshot?',
    title: 'Two edits by Friday.',
    brief: 'Maya likes the direction. She needs a softer opening line and a screenshot from the new build before Friday’s 10:00 review.',
    action: 'Send the revised note before Friday.',
  },
  priya: {
    category: 'respond', initials: 'PS', avatar: 'avatar-peach', from: 'Priya Shah', time: '8:18 AM',
    subject: 'Budget for the next sprint', snippet: 'Can you review these numbers before we meet?',
    title: 'Budget review requested.',
    brief: 'Priya sent the next sprint budget and asked you to review the numbers before your meeting.',
    action: 'Review the budget and reply to Priya.',
  },
  jules: {
    category: 'waiting', initials: 'JT', avatar: 'avatar-blue', from: 'Jules Turner', time: 'Yesterday',
    subject: 'Re: September handoff', snippet: 'I’ll send the handoff notes after the team review.',
    title: 'Waiting on handoff notes.',
    brief: 'Jules said the September handoff notes will follow the team review. No reply is needed yet.',
    action: 'Check back after the team review.',
  },
  alex: {
    category: 'fyi', initials: 'AR', avatar: 'avatar-green', from: 'Alex Rivera', time: 'Yesterday',
    subject: 'Design files for tomorrow', snippet: 'The updated files are ready in the shared folder.',
    title: 'New design files are ready.',
    brief: 'Alex shared the updated design files for tomorrow. They are ready for you to review when needed.',
    action: 'Open the shared files before tomorrow.',
  },
  letter: {
    category: 'fyi', initials: 'WL', avatar: 'avatar-peach', from: 'The Weekly Letter', time: 'Monday',
    subject: 'Five things worth reading', snippet: 'This week’s notes from the product desk.',
    title: 'A read for later.',
    brief: 'This is a newsletter for reference. It does not appear to need a reply.',
    action: 'Read it when you have time.',
  },
  bot: {
    category: 'notifications', initials: 'DB', avatar: 'avatar-blue', from: 'Deploy bot', time: '7:56 AM',
    subject: 'Build passed on main', snippet: 'The latest build is ready for review.',
    title: 'The build passed.',
    brief: 'The latest build on main passed and is ready for review. This message is a notification.',
    action: 'Open the build if you want to check it.',
  },
};

const byCategory = {
  respond: ['maya', 'priya'],
  waiting: ['jules'],
  fyi: ['alex', 'letter'],
  notifications: ['bot'],
};
const list = document.querySelector('#preview-messages');
const tabs = [...document.querySelectorAll('[data-category]')];
const title = document.querySelector('#brief-title');
const copy = document.querySelector('#brief-copy');
const action = document.querySelector('#brief-action');
const draftJump = document.querySelector('[data-draft-jump]');
let category = 'respond';
let selected = 'maya';

function selectMessage(id) {
  const mail = messages[id];
  if (!mail) return;
  selected = id;
  title.textContent = mail.title;
  copy.textContent = mail.brief;
  action.textContent = mail.action;
  draftJump.hidden = mail.category !== 'respond';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelector('.companion-body')?.animate(
      [{ opacity: .7, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
  }
  list.querySelectorAll('[data-message]').forEach((row) => {
    const active = row.dataset.message === id;
    row.classList.toggle('is-selected', active);
    row.setAttribute('aria-pressed', String(active));
  });
}

function showCategory(next) {
  if (!byCategory[next]) return;
  category = next;
  tabs.forEach((tab) => {
    const active = tab.dataset.category === next;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  list.replaceChildren(...byCategory[next].map((id) => {
    const mail = messages[id];
    const row = document.createElement('button');
    row.className = 'message-row';
    row.type = 'button';
    row.dataset.message = id;
    row.setAttribute('aria-pressed', 'false');
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar ' + mail.avatar;
    avatar.textContent = mail.initials;
    const content = document.createElement('span');
    content.className = 'message-content';
    const top = document.createElement('span');
    top.className = 'message-top';
    const from = document.createElement('strong');
    from.textContent = mail.from;
    const time = document.createElement('time');
    time.textContent = mail.time;
    top.append(from, time);
    const subject = document.createElement('b');
    subject.textContent = mail.subject;
    const snippet = document.createElement('small');
    snippet.textContent = mail.snippet;
    content.append(top, subject, snippet);
    const unread = document.createElement('span');
    unread.className = 'message-dot';
    unread.setAttribute('aria-label', 'Unread');
    row.append(avatar, content, unread);
    row.addEventListener('click', () => selectMessage(id));
    return row;
  }));
  selectMessage(byCategory[next][0]);
}
tabs.forEach((tab) => tab.addEventListener('click', () => showCategory(tab.dataset.category)));
showCategory(category);

const draftText = {
  warm: 'Hi Maya, thanks for the clear notes. I’ll soften the opening and swap in the new screenshot before Friday’s review. Best, Alex',
  brief: 'Hi Maya, I’ll update the opening and screenshot before Friday at 10. Thanks, Alex',
  formal: 'Hi Maya, thank you for the feedback. I will revise the opening line and replace the screenshot before Friday’s review. Best regards, Alex',
};
const draftOutput = document.querySelector('#draft-copy');
document.querySelectorAll('[data-tone]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-tone]').forEach((tone) => tone.setAttribute('aria-pressed', String(tone === button)));
    draftOutput.textContent = draftText[button.dataset.tone];
  });
});
document.querySelector('[data-draft-jump]')?.addEventListener('click', () => {
  document.querySelector('#drafts')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
});

const commandMenu = document.querySelector('#command-menu');
const openCommand = document.querySelector('[data-command-open]');
const closeCommand = document.querySelector('[data-command-close]');
let lastFocus = null;
function toggleCommand(open) {
  commandMenu.hidden = !open;
  if (open) {
    lastFocus = document.activeElement;
    closeCommand.focus();
  } else {
    lastFocus?.focus();
  }
}
openCommand?.addEventListener('click', () => toggleCommand(true));
closeCommand?.addEventListener('click', () => toggleCommand(false));
commandMenu?.addEventListener('click', (event) => {
  if (event.target === commandMenu) toggleCommand(false);
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.repeat) {
    event.preventDefault();
    toggleCommand(commandMenu.hidden);
  } else if (event.key === 'Escape' && !commandMenu.hidden) {
    event.preventDefault();
    toggleCommand(false);
  } else if (event.key === 'Tab' && !commandMenu.hidden) {
    const actions = [...commandMenu.querySelectorAll('button')];
    const first = actions[0], last = actions.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.querySelectorAll('[data-command-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const choice = button.dataset.commandAction;
    toggleCommand(false);
    if (choice === 'draft') draftJump.click();
    else showCategory(choice);
  });
});

const date = document.querySelector('.inbox-date');
if (date) date.textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date()).toUpperCase();

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .08, rootMargin: '0px 0px -24px 0px' });
  document.querySelectorAll('.hero-copy, .stage-intro, .app-window, .section-heading, .feature, .modes-intro, .mode-option, .final-cta').forEach((element) => {
    element.classList.add('reveal');
    observer.observe(element);
  });
}
