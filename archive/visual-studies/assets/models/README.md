# PigeonBox miniature models

The seven landmark models and `pigeon/courier.glb` are original PigeonBox models built from the authored construction and
sculpting definitions in `journey/pigeon.js`, `journey/monuments.js`,
`journey/landmark-details.js`, and `journey/craft.js`. They are not third-party
asset-store models or Blender-authored files.

Run `node scripts/export-models.mjs` from the repository root to rebuild the
eight GLBs and their manifest. The export retains hierarchy and named parts,
deduplicates vertices without erasing hard-normal seams, and uses shared
geometry/material accessors. Models contain no external textures or network
dependencies. Three.js r186 GLTFLoader successfully parses each output.

Runtime loads the current courier and rooftop before first paint, then loads
later landmarks serially. Landmark geometry is adopted into validated named
parts of the existing rigs, retaining animation callbacks, procedural window
shaders and the live cloth flag. A failed courier request leaves the original
procedural rig in place. The older `courier.glb` export uses
EXT_mesh_gpu_instancing; it is retained as an authored reference.

## Current courier

`pigeon/gascogne-pigeon.glb` is a web-optimized version of [Gascogne Pigeon
Bird (Lowpoly) Free by Nyi Nyi Tun](https://www.fab.com/listings/d1156707-573d-42cb-ac12-2702f06284f3),
downloaded under the [Fab Standard License](https://www.fab.com/eula). Fab
permits commercial use in an incorporated project but prohibits standalone
redistribution of the asset. `scripts/optimize-pigeon.py` rebuilds this file
from the licensed download, reducing five 4K textures to web-sized textures.
The downloaded source GLB is not included here.

`pigeon/flight.png` and `pigeon/flight-down.png` are matching flight poses
generated for PigeonBox. The continuous scroll path still controls the bird's
position and orientation; these two images provide the wingbeat while the
licensed 3D model provides the close-up perches. The original procedural rig
remains available as a loading fallback.
