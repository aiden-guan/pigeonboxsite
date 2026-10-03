# PigeonBox website

The live marketing site is `https://usepigeonbox.com`. This nested checkout is the canonical website repository. It is static HTML, CSS and JavaScript; no framework installation or build is required for the pages.

- Pages: `index.html`, `local.html`, `cloud.html`, `waitlist.html`, `pricing.html`, `docs.html`, `privacy.html`, `security.html`, `terms.html`.
- Shared visual system: `dispatch.css`, `site.js`, `halftone.js`; homepage composition: `home.css` and `home.js`.
- Waitlist: `waitlist.css` and `waitlist.js`. The public endpoint URL is in `site-config.json`; credentials stay in the private Cloud backend. No mailing service or automatic emails.
- Deployment: existing Vercel project, `vercel.json` routes and security headers, `.vercelignore` deployment exclusions.
- Verify: `node scripts/verify-site.mjs` uses Playwright from the adjacent `PigeonBox` checkout. Screenshots go to `/tmp/pigeonbox-site-qa` by default.
- Walkthrough: [build instructions](scripts/gmail-demo/README.md); fictional mail with real extension components. Rebuild after committing the public source.
- History: [visual studies](archive/visual-studies/README.md), excluded from production. Active brand artwork stays in `brand/`.

The public extension lives in the separate PigeonBox repository; accounts, persistence and runtime infrastructure remain in the private pigeonbox-cloud repository. Keep local configuration and runtime paths in place.
