# Miniature overhaul baseline

Captured 2026-09-27 in the in-app browser at 1265 × 712. Baseline includes
inherited changes to materials, pigeon, terrain and camera; those changes
were present before this task. All seven stops were visually inspected and
screenshots recorded in the task before any visual edits.

| View | Synchronous GPU-inclusive benchmark ms | Draw calls | Triangles | Programs |
| --- | ---: | ---: | ---: | ---: |
| Rooftop | 4.15 | 174 | 577838 | 27 |
| Clock tower | 4.35 | 266 | 624356 | 28 |
| Windmill | 4.49 | 253 | 582758 | 29 |
| Lighthouse | 6.58 | 238 | 613078 | 32 |
| Pyramid | 5.95 | 239 | 806908 | 33 |
| Summit | 5.56 | 187 | 745278 | 36 |
| Home | 4.15 | 229 | 706618 | 37 |

These are 30-frame `world.bench()` samples with readPixels synchronization,
not a claim about sustained FPS or physical mobile performance.

Observed issues: hovering bird with no feet/folding/landing response; all
stop cameras at 64 degrees elevation; raw faceted vegetation, sharp building
edges, primitive summit rocks; daylight-like home plaza. Three r186 warns
that PCFSoftShadowMap was removed and falls back to PCFShadowMap.

Preserve native scroll, seven stop associations, CatmullRom path, procedural
terrain painting, instancing, product demos, HUD/tether and static fallback.
The primary reference was visually inspected: warm miniature proportions,
soft architectural edges, layered props, controlled shadows and materials.
