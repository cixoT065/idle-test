#!/usr/bin/env python3
"""Generate an alternate-idle and an attack frame for each base sprite via image-edit."""
import os, json, base64, urllib.request, time
import numpy as np
from PIL import Image

KEY = os.environ["OR_KEY"]
MODEL = "google/gemini-2.5-flash-image"
SLUGS = ["warrior","rogue","wizard","slime","giant_rat","goblin_scout","cave_bat","kobold_miner",
         "forest_spider","undead_soldier","mutated_slime","rabid_wolf","shrieking_fungus","orc_grunt",
         "troll","ogre_mage","goblin_shaman","stone_golem","goblin_king","slime_mother","hydra",
         "dragon_whelp","chronos_tyrant"]
HUMANOID = {"warrior","rogue","wizard","goblin_scout","undead_soldier","orc_grunt","ogre_mage",
            "goblin_shaman","goblin_king","kobold_miner"}
BASE = ("Keep the SAME character — identical design, colors, proportions and 16-bit pixel-art style. "
        "Full body, character only, on a 100% uniform flat solid magenta (#FF00FF) background, no scenery. ")

def prompt(slug, kind):
    if kind == "idle2":
        return BASE + "Redraw it in a subtly different relaxed idle breathing pose (slight weight shift), upright and standing, same overall size."
    if slug == "wizard":
        return BASE + "Redraw it casting a spell: staff raised high with a glowing magical gesture, upright, same overall size."
    if slug in HUMANOID:
        return BASE + "Redraw it in a dynamic attack pose: weapon thrust forward in a striking motion, upright and standing, same overall size."
    return BASE + "Redraw it in an aggressive attacking lunge: mouth open or claws/body striking forward, same overall size."

def edit(src_b64, instr, out_raw):
    content = [{"type": "text", "text": instr},
               {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{src_b64}"}}]
    body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": content}],
                       "modalities": ["image", "text"]}).encode()
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=180))
    imgs = d["choices"][0]["message"].get("images") or []
    if not imgs: return None, 0
    open(out_raw, "wb").write(base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1]))
    return True, d.get("usage", {}).get("cost", 0)

def keyout(raw, out, tol=115):
    im = Image.open(raw).convert("RGBA"); a = np.array(im); h, w = a.shape[:2]
    c = np.stack([a[0,0,:3], a[0,w-1,:3], a[h-1,0,:3], a[h-1,w-1,:3]]).astype(np.int16); bg = np.median(c, 0)
    dist = np.sqrt(((a[..., :3].astype(np.int16) - bg) ** 2).sum(-1))
    a[..., 3] = np.where(dist < tol, 0, 255).astype(np.uint8)
    res = Image.fromarray(a, "RGBA"); bb = res.getbbox()
    if bb: res = res.crop(bb)
    res.save(out)

total = 0.0
for i, slug in enumerate(SLUGS, 1):
    base = f"src/assets/generated/{slug}.png"
    src_b64 = base64.b64encode(open(base, "rb").read()).decode()
    for kind in ("idle2", "atk"):
        out = f"scripts/frames/{slug}_{kind}.png"
        if os.path.exists(out): print(f"[{i}] {slug}_{kind}: skip", flush=True); continue
        for attempt in range(2):
            try:
                ok, cost = edit(src_b64, prompt(slug, kind), f"scripts/frames/{slug}_{kind}_raw.png")
                if not ok: print(f"[{i}] {slug}_{kind}: NO IMAGE", flush=True); break
                keyout(f"scripts/frames/{slug}_{kind}_raw.png", out); total += cost
                print(f"[{i}] {slug}_{kind}: ${cost:.4f} (total ${total:.3f})", flush=True); break
            except Exception as e:
                print(f"[{i}] {slug}_{kind}: err {e}", flush=True); time.sleep(3)
print(f"DONE total ${total:.3f}", flush=True)
