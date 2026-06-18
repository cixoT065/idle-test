#!/usr/bin/env python3
import os, sys, json, base64, urllib.request, time
import numpy as np
from PIL import Image

KEY = os.environ["OR_KEY"]
MODEL = os.environ.get("OR_MODEL", "google/gemini-3-pro-image-preview")
STYLE = ("Highly detailed 16-bit JRPG pixel-art battle sprite in the style of classic Final "
         "Fantasy Brave Exvius units. Full body, single centered original character, crisp clean "
         "outline, vibrant saturated colors, dramatic shading. The character is completely ISOLATED "
         "on a 100% uniform flat solid magenta (#FF00FF) chroma-key background: absolutely no scenery, "
         "no environment, no ground, no floor, no atmospheric haze, no particles or effects outside "
         "the character silhouette. Character only. No text, no UI, no watermark.")

ENTITIES = [
  ("warrior", "An original heroic knight warrior in ornate plate armor with a red cape, holding a longsword and shield, facing right in a battle-ready idle stance"),
  ("rogue", "An agile original rogue assassin in dark leather armor with a hood and dual daggers, facing right in a nimble crouched battle stance"),
  ("wizard", "An original arcane wizard mage in a flowing blue robe and pointed hat holding a glowing magic staff, facing right in a spellcasting stance"),
  ("slime", "A cute blue gelatinous slime monster with a glossy translucent surface, facing left"),
  ("giant_rat", "A large mangy giant rat monster with red eyes and sharp teeth, facing left"),
  ("goblin_scout", "A small green goblin scout monster with a dagger and leather scraps, facing left"),
  ("cave_bat", "A dark purple winged cave bat monster with fangs and spread wings, facing left"),
  ("kobold_miner", "A small brown kobold lizard miner monster holding a pickaxe, facing left"),
  ("forest_spider", "A large green forest spider monster with eight legs and red eyes, facing left"),
  ("undead_soldier", "An undead skeletal soldier monster in rusted armor holding a broken sword, facing left"),
  ("mutated_slime", "A large menacing mutated acid slime monster, bubbling green ooze with a glowing core, facing left"),
  ("rabid_wolf", "A fierce rabid grey wolf monster snarling with bared fangs, facing left"),
  ("shrieking_fungus", "A grotesque shrieking fungus mushroom monster with a gaping fanged mouth and spores, facing left"),
  ("orc_grunt", "A burly green orc grunt warrior monster with tusks wielding a crude axe, facing left"),
  ("troll", "A massive hulking green troll monster swinging a wooden club, facing left"),
  ("ogre_mage", "A large blue-skinned ogre mage monster holding a glowing orb staff, facing left"),
  ("goblin_shaman", "A green goblin shaman monster with a bone staff and tribal mask, facing left"),
  ("stone_golem", "A massive rocky stone golem monster with glowing magical runes, facing left"),
  ("goblin_king", "An imposing goblin king BOSS monster named Grimgnaw with a golden crown, fur cloak and a giant cleaver, large and epic, facing left"),
  ("slime_mother", "A gigantic queen slime mother BOSS monster, huge translucent jelly body with tiny slimes inside and a regal crown, epic, facing left"),
  ("hydra", "A fearsome three-headed green hydra dragon BOSS monster, long serpentine necks, large and epic, facing left"),
  ("dragon_whelp", "A young red dragon whelp BOSS monster with spread wings breathing fire, epic, facing left"),
  ("chronos_tyrant", "An epic FINAL BOSS, the Chronos Tyrant: a colossal armored time-warping demon god wielding a clock-themed scythe, swirling purple cosmic energy, ominous and grand, facing left"),
]

def gen(subject, raw):
    body = json.dumps({"model": MODEL, "messages": [{"role": "user", "content": f"{subject}. {STYLE}"}],
                       "modalities": ["image", "text"]}).encode()
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=240))
    imgs = d["choices"][0]["message"].get("images") or []
    if not imgs: return None, 0
    open(raw, "wb").write(base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1]))
    return True, d.get("usage", {}).get("cost", 0)

def keyout(raw, out, tol=115):
    im = Image.open(raw).convert("RGBA"); a = np.array(im); h, w = a.shape[:2]
    corners = np.stack([a[0,0,:3], a[0,w-1,:3], a[h-1,0,:3], a[h-1,w-1,:3]]).astype(np.int16)
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((a[..., :3].astype(np.int16) - bg) ** 2).sum(-1))
    a[..., 3] = np.where(dist < tol, 0, 255).astype(np.uint8)
    res = Image.fromarray(a, "RGBA"); bbox = res.getbbox()
    if bbox: res = res.crop(bbox)
    res.save(out); return res.size

total = 0.0
for i, (slug, subj) in enumerate(ENTITIES, 1):
    out = f"src/assets/generated/{slug}.png"
    if os.path.exists(out):
        print(f"[{i}/{len(ENTITIES)}] {slug}: exists, skip", flush=True); continue
    for attempt in range(2):
        try:
            ok, cost = gen(subj, f"src/assets/generated/{slug}_raw.png")
            if not ok: print(f"[{i}/{len(ENTITIES)}] {slug}: NO IMAGE", flush=True); break
            size = keyout(f"src/assets/generated/{slug}_raw.png", out)
            total += cost
            print(f"[{i}/{len(ENTITIES)}] {slug}: {size} ${cost:.4f} (total ${total:.3f})", flush=True); break
        except Exception as e:
            print(f"[{i}/{len(ENTITIES)}] {slug}: error {e} (attempt {attempt+1})", flush=True); time.sleep(3)
print(f"DONE. generated cost ${total:.3f}", flush=True)
