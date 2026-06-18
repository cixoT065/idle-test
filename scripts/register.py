#!/usr/bin/env python3
"""Register each character's frames (idle, idle2, a1/a2/a3 attack, hurt) onto a
shared bottom-centered canvas so frame swaps never jump."""
import os, glob
from PIL import Image

TARGET_H = 300
MAXDIM = 340
F = "scripts/frames"
# output suffix  ->  source file stem in scripts/frames/
SRC = [("_b", "idle2"), ("_a1", "a1"), ("_a2", "a2"), ("_a3", "a3"), ("_hurt", "hurt")]

def load(p):
    if not os.path.exists(p): return None
    im = Image.open(p).convert("RGBA"); bb = im.getbbox()
    return im.crop(bb) if bb else im

SUFFIXES = ("_b", "_a1", "_a2", "_a3", "_hurt", "_atk", "_atk2")
slugs = [os.path.basename(p)[:-4] for p in glob.glob("src/assets/generated/*.png")
         if not os.path.basename(p)[:-4].endswith(SUFFIXES)]

done = 0
for slug in sorted(slugs):
    idle1 = load(f"src/assets/generated/{slug}.png")
    if idle1 is None:
        continue
    frames = [("", idle1)]
    for out_suffix, stem in SRC:
        im = load(f"{F}/{slug}_{stem}.png")
        if im is not None:
            frames.append((out_suffix, im))
    # Scale every frame to the same height (same character ⇒ same on-screen size).
    scaled = [(suf, im.resize((max(1, round(im.width * TARGET_H / im.height)), TARGET_H), Image.LANCZOS))
              for suf, im in frames]
    W = max(f.width for _, f in scaled); H = TARGET_H
    fit = min(1.0, MAXDIM / max(W, H))
    for suf, f in scaled:
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.paste(f, ((W - f.width) // 2, H - f.height), f)  # bottom, centered
        if fit < 1:
            canvas = canvas.resize((round(W * fit), round(H * fit)), Image.LANCZOS)
        canvas.save(f"src/assets/generated/{slug}{suf}.png", optimize=True)
    done += 1
    print(f"{slug}: {len(scaled)} frames", flush=True)
print(f"DONE registered {done}", flush=True)
