# Approved Pidgy artwork

The compact model follows the gift and lantern references. The website's main atlas is `brand/pidgy.webp`; the extended atlas is `brand/pidgy-world.webp`. Generation provenance is in `generation-prompt.md` and `compact-source.png`.

Run `node scripts/pidgy/sync-brand.mjs` from the website root to update the adjacent PigeonBox and pigeonbox-cloud checkouts. Optional arguments select those roots explicitly. It derives the app's existing 320×256 sprite cells, icons, demo/Cloud copies, ink-density atlas, and film cells from the approved artwork. This is a local asset operation.

Run `node scripts/pidgy/verify-brand.mjs` to check copy parity, alpha, frame padding and foot registration. Rebuild the website demo with `node scripts/gmail-demo/build.mjs`; its source snapshot includes the sprite sheet and icons. `render-share-image.mjs` creates the refreshed 1200×630 share image and 1600×900 launch-poster preview from the latest Chrome Web Store screenshot.

Run `node scripts/pidgy/render-share-image.mjs` to crop the current Chrome Web Store inbox screenshot and render the site's 1200×630 Open Graph image.

The app's `pack-pigeon.mjs` reproduces its production atlas from its regular `brand-src/pigeon-states.png` source. The Python entry point delegates to it. The film's `gen_pigeon.mjs` derives its mascot and flight cells from the approved production art; its Python entry point delegates too. Store graphics retain the existing generator and use refreshed fictional UI captures.

Historical visual studies, archived captures, and previously published GitHub/store assets are records of earlier versions. They are not active source assets. Publication requires a separate release/deployment operation.
