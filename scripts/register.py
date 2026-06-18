#!/usr/bin/env python3
"""Register each character's frames (idle, idle2, attack, optional 2nd attack)
onto a shared bottom-centered canvas so frame swaps don't jump."""
import os, glob
from PIL import Image

TARGET_H = 300
MAXDIM = 340

def load(p):
    if not os.path.exists(p): return None
    im = Image.open(p).convert("RGBA"); bb = im.getbbox()
    return im.crop(bb) if bb else im

slugs = [os.path.basename(p)[:-4] for p in glob.glob("src/assets/generated/*.png")
         if not any(p.endswith(s) for s in ("_b.png", "_atk.png", "_atk2.png"))]

done = 0
for slug in sorted(slugs):
    idle1 = load(f"src/assets/generated/{slug}.png")
    if idle1 is None:
        continue
    # (output suffix, source image) — keep whichever frames exist, in play order.
    candidates = [
        ("", idle1),
        ("_b", load(f"scripts/frames/{slug}_idle2.png") or idle1),
        ("_atk", load(f"scripts/frames/{slug}_atk.png") or idle1),
    ]
    atk2 = load(f"scripts/frames/{slug}_atk2.png")
    if atk2 is not None:
        candidates.append(("_atk2", atk2))

    # Scale every frame to the same height (same character ⇒ same on-screen size).
    scaled = []
    for suffix, im in candidates:
        s = TARGET_H / im.height
        scaled.append((suffix, im.resize((max(1, round(im.width * s)), TARGET_H), Image.LANCZOS)))
    W = max(f.width for _, f in scaled); H = TARGET_H
    fit = min(1.0, MAXDIM / max(W, H))
    for suffix, f in scaled:
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.paste(f, ((W - f.width) // 2, H - f.height), f)  # bottom, centered
        if fit < 1:
            canvas = canvas.resize((round(W * fit), round(H * fit)), Image.LANCZOS)
        canvas.save(f"src/assets/generated/{slug}{suffix}.png", optimize=True)
    done += 1
    print(f"{slug}: {len(scaled)} frames {scaled[0][1].size if fit>=1 else ''}", flush=True)
print(f"DONE registered {done} characters", flush=True)
PY
