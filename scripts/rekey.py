#!/usr/bin/env python3
"""Re-key all generated raws with an edge-connected flood fill (robust to non-flat backdrops)."""
import glob, os, numpy as np
from PIL import Image

def rekey(raw, out, tol=95):
    im = Image.open(raw).convert("RGBA"); a = np.array(im); h, w = a.shape[:2]
    rgb = a[..., :3].astype(np.int16)
    border = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    similar = np.sqrt(((rgb - bg) ** 2).sum(-1)) < tol      # bg-coloured pixels
    mask = np.zeros((h, w), bool)                            # seed from the 4 edges
    mask[0, :] |= similar[0, :]; mask[-1, :] |= similar[-1, :]
    mask[:, 0] |= similar[:, 0]; mask[:, -1] |= similar[:, -1]
    prev = -1
    while int(mask.sum()) != prev:                          # grow within similar until stable
        prev = int(mask.sum())
        g = mask.copy()
        g[1:, :] |= mask[:-1, :]; g[:-1, :] |= mask[1:, :]
        g[:, 1:] |= mask[:, :-1]; g[:, :-1] |= mask[:, 1:]
        mask = g & similar
    a[..., 3] = np.where(mask, 0, 255).astype(np.uint8)
    res = Image.fromarray(a, "RGBA"); bbox = res.getbbox()
    if bbox: res = res.crop(bbox)
    res.save(out)
    return res.size, (1 - mask.mean())  # size, fraction kept

for raw in sorted(glob.glob("src/assets/generated/*_raw.png")):
    out = raw.replace("_raw.png", ".png")
    size, kept = rekey(raw, out)
    print(f"{os.path.basename(out):22} {str(size):14} kept={kept:.2f}")
