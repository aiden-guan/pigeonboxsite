"""Prepare the separately licensed Fab pigeon for the site's GLB loader.

Usage: python3 scripts/optimize-pigeon.py /path/to/download.glb
Requires Pillow only while building the asset; the website has no dependency.
"""

import json
import struct
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image


SOURCE = Path(sys.argv[1])
OUTPUT = Path(__file__).resolve().parents[1] / "assets/models/pigeon/gascogne-pigeon.glb"

data = SOURCE.read_bytes()
magic, version, _ = struct.unpack_from("<III", data)
assert magic == 0x46546C67 and version == 2, "Expected a glTF 2 GLB"
json_size, json_type = struct.unpack_from("<II", data, 12)
assert json_type == 0x4E4F534A
document = json.loads(data[20 : 20 + json_size])
binary_start = 20 + json_size
binary_size, binary_type = struct.unpack_from("<II", data, binary_start)
assert binary_type == 0x004E4942
binary = data[binary_start + 8 : binary_start + 8 + binary_size]

assert len(document["meshes"]) == 1 and len(document["images"]) == 5, "Unexpected Fab asset layout"

images = {}
for index, image in enumerate(document["images"]):
    view = document["bufferViews"][image["bufferView"]]
    raw = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
    source = Image.open(BytesIO(raw))
    target_size = 2048 if index == 0 else 1024
    source.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    target = BytesIO()
    alpha = source.mode == "RGBA" and source.getchannel("A").getextrema()[0] < 255
    source.convert("RGBA" if alpha else "RGB").save(
        target, format="WEBP", quality=92 if index in (0, 3) else 88, method=6
    )
    mime = "image/webp"
    images[image["bufferView"]] = (target.getvalue(), mime)
    image["mimeType"] = mime

for texture in document["textures"]:
    texture.setdefault("extensions", {})["EXT_texture_webp"] = {"source": texture.pop("source")}
document.setdefault("extensionsUsed", []).append("EXT_texture_webp")
document.setdefault("extensionsRequired", []).append("EXT_texture_webp")

compact = bytearray()
for index, view in enumerate(document["bufferViews"]):
    if index in images:
        chunk = images[index][0]
    else:
        offset = view.get("byteOffset", 0)
        chunk = binary[offset : offset + view["byteLength"]]
    while len(compact) % 4:
        compact.append(0)
    view["byteOffset"] = len(compact)
    view["byteLength"] = len(chunk)
    compact.extend(chunk)

document["buffers"][0]["byteLength"] = len(compact)
json_chunk = json.dumps(document, separators=(",", ":")).encode("utf-8")
json_chunk += b" " * (-len(json_chunk) % 4)
compact.extend(b"\0" * (-len(compact) % 4))
total = 12 + 8 + len(json_chunk) + 8 + len(compact)
OUTPUT.write_bytes(
    struct.pack("<III", magic, version, total)
    + struct.pack("<II", len(json_chunk), 0x4E4F534A)
    + json_chunk
    + struct.pack("<II", len(compact), 0x004E4942)
    + compact
)
print(f"{SOURCE.stat().st_size:,} -> {OUTPUT.stat().st_size:,} bytes: {OUTPUT}")
