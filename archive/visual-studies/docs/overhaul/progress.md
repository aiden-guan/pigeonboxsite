# Miniature-world overhaul: active work

This is a progress record, not final acceptance. Full brief is in the task attachment.

## Implemented

- Courier now has a continuous body/neck/head surface, custom tapered folded
  wings with vertex-color bars, smaller inset eyes and a tapered beak. 19,020
  triangles. This remains stylized and has NOT met the user realism request.
- Eight original GLBs exported from authored construction definitions; official
  Three r186 loader, cache, byte progress, safe fallback and validated rig adoption.
  Courier and rooftop load first; later sets load serially after first paint.
  Source is procedural authoring, not Blender. Feather instances survive export.
- All seven sets have bevels and courier details. Rooftop has tiles, dormer,
  gutters and terrace; clock arched windows and trim; windmill framed sails;
  lighthouse rails and cottage; pyramid survey shelter; summit trail details;
  home mailbox relief, proper benches and bicycles.
- Instanced soft canopy/pine/rock variants, closed palm fronds, beveled secondary
  architecture, shaped boats, smooth terrain normals and ground contact painting.
- Three-quarter cameras, revised dawn/night palette, restrained water,
  high/medium/mobile resolution/shadow tiers, regional scenery batches and motion.
- Preserved native scroll, all seven stops, curves, cards, demos, HUD and tether.
- Debug panel has synchronous benchmark, live frame sampling, courier close-up
  and scene PNG export. Ordinary visitors do not load this panel.

## Current verification

- All seven baseline desktop views captured in chat; baseline metrics in baseline.md.
- Revised desktop views inspected at each stop. Latest rooftop tile pass and
  home benches visibly verified. Windmill camera/back-window changes still need
  a fresh view. Final mobile and reduced-motion regressions remain outstanding.
- `node scripts/verify-models.mjs` parses and adopts every GLB, checks finite
  geometry and exercises courier/landmark animation callbacks. Passes.
- `git diff --check` passes. All eight assets adopted in browser diagnostics.
- Opening synchronous render/readPixels benchmark: 4.22 ms, 279 calls,
  1,229,670 triangles, DPR 1.75. Baseline 4.15 ms, 174 calls, 577,838 triangles.
  These are not sustained frame-rate measurements. Full final metrics pending.
- Removed duplicate flight perch-height offset found during verification.
- Previous browser account-limit denial has resolved; browser QA is available.

## Remaining acceptance work

1. Inspect windmill and all flight/landing transitions after the latest edits.
2. Complete desktop/mobile/static/reduced-motion and interactive-demo regression.
3. Collect all seven final metrics plus live frame samples; optimize any regressions.
4. Save scene artifacts and compare all seven baseline/final views.
5. Final lighting/tone-map review, cleanup and delivery report with compromises.

Preview: `scripts/serve.py`, http://127.0.0.1:8766/?debug.
No commit, push or deployment performed. Inherited edits preserved.

## Latest user correction

User rejected the bird and asked for an actual realistic bird, not assembled
shapes. This supersedes the brief's earlier stylized-only preference for the
mascot. Continuous-body custom revision is a temporary improvement, not accepted
as realistic. Asked whether the brief's prohibition on third-party assets may be
relaxed for a carefully selected licensed rigged pigeon; response pending.
Do not continue calling the current bird polished or claim visual acceptance.

The live opening sample before the latest bird change was 361 frames / 3 seconds,
mean 8.34 ms, p95 8.5 ms, zero intervals above 33.3 ms, DPR 1.75 on this machine.
Mobile density reduction now retains 50% of distant vegetation with coordinate
hashing to keep trunks and crowns matched, preserving all vegetation near stops.
PNG download and data-image download time out in IAB. Debug capture now shows a
preview, but saved screenshot artifacts are still outstanding.
