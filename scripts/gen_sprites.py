#!/usr/bin/env python3
"""Generate FFBE-style sprites via OpenRouter and chroma-key them to transparent PNGs."""
import os, sys, json, base64, urllib.request
import numpy as np
from PIL import Image

KEY = os.environ["OR_KEY"]
MODEL = os.environ.get("OR_MODEL", "google/gemini-2.5-flash-image")
BG = (255, 0, 255)  # magenta backdrop — rare in characters, clean to key out
STYLE = ("highly detailed 16-bit JRPG pixel-art battle sprite in the style of classic "
         "Final Fantasy Brave Exvius units, full body, crisp clean outline, vibrant saturated "
         "colors, single centered original character, plain flat solid magenta (#FF00FF) "
         "background, no text, no UI, no watermark, no shadow on the ground.")

def generate(subject, out_raw):
    prompt = f"{subject}. {STYLE}"
    body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": prompt}],
                       "modalities": ["image", "text"]}).encode()
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=180))
    cost = d.get("usage", {}).get("cost")
    imgs = d["choices"][0]["message"].get("images") or []
    if not imgs:
        print("  no image:", d["choices"][0]["message"].get("content", "")[:160]); return None
    b64 = imgs[0]["image_url"]["url"].split(",", 1)[1]
    open(out_raw, "wb").write(base64.b64decode(b64))
    return cost

def keyout(in_raw, out_png, tol=115):
    im = Image.open(in_raw).convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    corners = np.stack([a[0,0,:3], a[0,w-1,:3], a[h-1,0,:3], a[h-1,w-1,:3]]).astype(np.int16)
    bg = np.median(corners, axis=0)       # learn the real backdrop colour
    dist = np.sqrt(((a[..., :3].astype(np.int16) - bg) ** 2).sum(-1))
    a[..., 3] = np.where(dist < tol, 0, 255).astype(np.uint8)
    res = Image.fromarray(a, "RGBA")
    bbox = res.getbbox()                  # autocrop to the character
    if bbox: res = res.crop(bbox)
    res.save(out_png)
    return res.size

if __name__ == "__main__":
    subject = sys.argv[1]
    out = sys.argv[2]
    raw = out.replace(".png", "_raw.png")
    c = generate(subject, raw)
    if c is not None:
        size = keyout(raw, out)
        print(f"  saved {out} {size}  cost=${c}")
