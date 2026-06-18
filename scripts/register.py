#!/usr/bin/env python3
"""Register each character's idle/idle2/attack frames onto a shared bottom-centered canvas."""
import os, glob
from PIL import Image

TARGET_H = 300
MAXDIM = 340

def load(p):
    if not os.path.exists(p): return None
    im = Image.open(p).convert("RGBA"); bb = im.getbbox()
    return im.crop(bb) if bb else im

slugs = [os.path.basename(p)[:-4] for p in glob.glob("src/assets/generated/*.png")
         if not p.endswith("_b.png") and not p.endswith("_atk.png")]

done = 0
for slug in sorted(slugs):
    idle1 = load(f"src/assets/generated/{slug}.png")
    idle2 = load(f"scripts/frames/{slug}_idle2.png")
    atk = load(f"scripts/frames/{slug}_atk.png")
    if idle1 is None:
        continue
    if idle2 is None: idle2 = idle1   # no breathing frame → reuse base
    if atk is None: atk = idle1       # no attack frame → reuse base (still lunges)
    # scale every frame to the same height (same character ⇒ same on-screen size)
    fr = []
    for im in (idle1, idle2, atk):
        s = TARGET_H / im.height
        fr.append(im.resize((max(1, round(im.width * s)), TARGET_H), Image.LANCZOS))
    W = max(f.width for f in fr); H = TARGET_H
    scale = min(1.0, MAXDIM / max(W, H))
    outs = []
    for f in fr:
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.paste(f, ((W - f.width) // 2, H - f.height), f)  # bottom, centered
        if scale < 1:
            canvas = canvas.resize((round(W * scale), round(H * scale)), Image.LANCZOS)
        outs.append(canvas)
    outs[0].save(f"src/assets/generated/{slug}.png", optimize=True)
    outs[1].save(f"src/assets/generated/{slug}_b.png", optimize=True)
    outs[2].save(f"src/assets/generated/{slug}_atk.png", optimize=True)
    done += 1
    print(f"{slug}: registered {outs[0].size}", flush=True)
print(f"DONE registered {done} characters", flush=True)
