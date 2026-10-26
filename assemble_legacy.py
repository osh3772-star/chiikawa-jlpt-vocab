"""Restore the exact single-file baseline from existing public Git blob bytes.

No network, image decoding/re-encoding, packages, or private workspace inputs.
The compact HTML and 13 PNGs are immutable public inputs, not regenerated art.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
COMPACT = "legacy-input/compact-26279961.html"
COMPACT_BYTES = 15943825
COMPACT_SHA256 = "fb537bccebbb4526dade82dea543ae9c2a9973cea97fd4ae2a0918f9d8a1df5f"
FULL_BYTES = 24646852
FULL_SHA256 = "777f3694738039dc1a244d5661136eef75c7778bbebcace02caa5115c6e4231c"
PNG_PATHS = {'09526837455f4384430ef1e7f6c68b68b8e693da7fb57ce7185cba610e7303f3': 'chiikawa-pets/reviewed-foot-assets/00_R0_fixed.png', '0d48828ca2adbfe124489be261c2f9a78ad29ab037e0829af83fdf63e017dc48': 'chiikawa-pets/reviewed-foot-assets/03_R25_fixed.png', '1c90f622c51589025695a0fec55568719627cc2030582e06bb9617b89835f32d': 'chiikawa-pets/reviewed-foot-assets/01_R0_to_R25_1.png', '228915d0fde57acd3fce9aa06a303c4989bce72d107408984fe18e30325948ad': 'chiikawa-pets/reviewed-foot-assets/05_R25_to_R50_2.png', '40f956e223a22ed1eb978ee5163d46095d8e765bc561f5c162d364b87f8bbdf7': 'chiikawa-pets/reviewed-foot-assets/02_R0_to_R25_2.png', '4410d59938f0ef46dc70063a43fa42b3764cebbcf91241a737f8f373b8cb1c7a': 'chiikawa-pets/reviewed-foot-assets/11_R75_to_R0_2.png', '57796e78b711e408945d06126d687ee2944d90e744e520a93755f3d570adc065': 'chiikawa-pets/reviewed-foot-assets/07_R50_to_R75_1.png', '590155819ebae2b41dc2b90b2eb1eeac182117da8eaeee7a8dfe249e86f4c181': 'chiikawa-pets/reviewed-foot-assets/09_R75_fixed.png', '656290e36fb9c214ea07a34c0b8d4ca66a5367ca130f66ab6ed177b7e48c637c': 'chiikawa-pets/reviewed-foot-assets/10_R75_to_R0_1.png', '874a369c3c6ae2b1331ce66f56367c7194a233c30016f0d4b0d85c0169af4a95': 'chiikawa-pets/reviewed-foot-assets/08_R50_to_R75_2.png', 'a31368e4fac8a11ec638e3e5c864cd2d36c4c54fd0c545c239ab284b256fd7d3': 'chiikawa-pets/reviewed-foot-assets/06_R50_fixed.png', 'f89be8a1dca9efd10c998b901a995575f59fd98426944daca1ff563be33e2013': 'chiikawa-pets/reviewed-foot-assets/04_R25_to_R50_1.png', 'fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c': 'docs/assets/fde3946e1ad5a74f1830657510b5c3efad3ca9892c3653cdd8addaa3a6d8311c.png'}

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def restore(root=ROOT, check_only=False):
    root = Path(root)
    compact = (root / COMPACT).read_bytes()
    if len(compact) != COMPACT_BYTES or sha256(compact) != COMPACT_SHA256:
        raise ValueError("compact input byte count/hash mismatch")
    pattern = rb"assets/([0-9a-f]{64})\.png"
    refs = re.findall(pattern, compact)
    if len(refs) != 13 or {x.decode("ascii") for x in refs} != set(PNG_PATHS):
        raise ValueError("expected exactly the 13 approved PNG references")
    payloads = {}
    for digest, relative in PNG_PATHS.items():
        png = (root / relative).read_bytes()
        if not png.startswith(b"\x89PNG\r\n\x1a\n") or sha256(png) != digest:
            raise ValueError("PNG signature/hash mismatch: " + relative)
        # Base64 wraps unchanged bytes; no image decoder/encoder is involved.
        payloads[digest.encode("ascii")] = b"data:image/png;base64," + base64.b64encode(png)
    full = re.sub(pattern, lambda match: payloads[match[1]], compact)
    if len(full) != FULL_BYTES or sha256(full) != FULL_SHA256:
        raise ValueError("restored full HTML byte count/hash mismatch")
    target = root / "legacy-self-contained.html"
    if target.exists():
        old = target.read_bytes()
        if len(old) != FULL_BYTES or sha256(old) != FULL_SHA256:
            raise ValueError("existing legacy HTML differs; refusing to overwrite")
        result = "verified-existing"
    elif check_only:
        result = "verified-without-writing"
    else:
        # Exclusive creation also refuses a concurrent replacement.
        with target.open("xb") as handle:
            handle.write(full)
        result = "created"
    return {"status": result, "bytes": FULL_BYTES, "sha256": FULL_SHA256,
            "publicPNGCount": len(payloads), "networkRequests": 0}

if __name__ == "__main__":
    if sys.argv[1:] not in ([], ["--check"]):
        raise SystemExit("usage: python3 assemble_legacy.py [--check]")
    print(json.dumps(restore(check_only="--check" in sys.argv[1:]), indent=2))
