# Homepage Gmail walkthrough

Build from the canonical extension checkout:

```sh
rtk proxy node scripts/gmail-demo/build.mjs /Users/aidenguan/Documents/Projects/EmailApp
```

The build imports the unified `PigeonBoxWorkspace`, its `CurrentThread`,
`ThreadPanel`, `DispatchThreads`, and shared product styles directly from the
extension. It writes the static bundle and sprite sheet to `assets/gmail-demo/`,
with the base revision, working-tree status, and a hash of imported source files
recorded in `provenance.json`. Uncommitted UI updates are included in the build.
No copied approximation of the PigeonBox UI is maintained here. Rebuild whenever
the extension interface changes. The extension checkout is read only.

The Gmail host is a recreation of the default Gmail desktop layout. All mail,
summaries, drafts, and answers are fictional fixtures. The Chrome runtime shim
never opens tabs, sends mail, creates drafts, connects an account, or calls AI.

The 21-second sequence covers Inbox triage, an expanded thread brief, the current
conversation in Home, draft generation, a Gmail reply composer, and Ask Pigeon
with a cited source. The workspace remains beside Gmail throughout the loop.
One action timeline drives cursor travel, click ripples, screen transitions, and
camera framing. The cursor travels in 240 ms, settles for 40 ms, then clicks.
Zooms start on that click and hold on the clicked control or its resulting UI.
The draft action reframes its generated reply; consecutive Ask actions keep the
camera engaged rather than repeatedly pulling back. Only completed actions and
the loop boundary return to the wide view. Idle cursor movement is removed.
Inbox briefs, Home actions, and Ask navigation use the actual components' click
handlers. The animated Ask submission uses the supported pending-query command
contract; the workspace's own Ask handler renders its loading, answer, and source
states. The fixture supplies current-conversation context, intelligence, and a
fictional Ask response after 600 ms through the current runtime contract.
The source citation then opens the example thread in the recreated Gmail host.
The cursor targets the rendered app controls and shares the camera transform.
Playback pauses offscreen, in a hidden tab, or when the visitor presses Pause.
Reduced motion starts paused. The parent page offers an expanded dialog view.

Parent playback and responsive scaling: `gmail-demo.js`.
Playback scenes and fixtures: `main.tsx`.
Isolated, panel-sized workspace viewport: `workspace.tsx` and `sidepanel.html`.
Shared action timeline, camera framing, and easing: `motion.ts`.
Gmail host styling: `gmail.css`.
The generated bundle is self-contained; the public site does not need Node or
the extension repository at runtime.
