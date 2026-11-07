# PigeonBox website

Static HTML, CSS and JavaScript for usepigeonbox.com. The site describes the open-source extension and the optional server people host on their own accounts.

- Public pages: index, local, cloud (self-hosting), pricing, docs, privacy, security and terms.
- Shared visuals: dispatch.css, site.js, halftone.js, home.css and home.js. Pricing retains its interactive feature artwork.
- Installation links come from site-config.json. The site has no account, billing, waitlist or analytics backend.
- Legacy account and waitlist URLs redirect to /cloud. Historical dashboard copies and waitlist scripts are excluded from deployment.
- The extension and server are maintained in https://github.com/aiden-guan/pigeonbox. This site never needs a personal server URL or credentials.
- Deployment uses the existing Vercel project and vercel.json headers and routes.
- Run node scripts/verify-site.mjs with Playwright installed in the adjacent PigeonBox checkout. It checks public pages, links, responsive layouts and the absence of hosted-service requests.

The local Gmail walkthrough uses fictional mail with extension components; see scripts/gmail-demo/README.md. Archived visual studies are excluded from deployment.
