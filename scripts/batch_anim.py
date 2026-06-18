#!/usr/bin/env python3
"""Generate 3-frame attack (a1/a2/a3) + hurt pose for each character via image-edit."""
import os, json, base64, urllib.request, time
import numpy as np
from PIL import Image, ImageOps
KEY=os.environ["OR_KEY"]
F="scripts/frames"
CLASSES={"warrior":"melee","rogue":"melee","wizard":"mage"}
MONSTERS=["slime","giant_rat","goblin_scout","cave_bat","kobold_miner","forest_spider","undead_soldier",
 "mutated_slime","rabid_wolf","shrieking_fungus","orc_grunt","troll","ogre_mage","goblin_shaman",
 "stone_golem","goblin_king","slime_mother","hydra","dragon_whelp","chronos_tyrant"]
HUMANOID={"goblin_scout","undead_soldier","orc_grunt","ogre_mage","goblin_shaman","goblin_king","kobold_miner"}
ALL=list(CLASSES)+MONSTERS
BASE=("Keep the SAME character — identical design, colors, proportions and 16-bit pixel-art style. "
      "Full body, character only, on a 100% uniform flat solid magenta (#FF00FF) background, no scenery. ")

def kind(slug): return CLASSES.get(slug) or ("humanoid" if slug in HUMANOID else "beast")
def prompt(slug, fr):
    facing = "facing right" if slug in CLASSES else "facing left"
    k=kind(slug); base=BASE+f"The character is {facing}. Pose: "
    if fr=="a1":
        if k=="mage": return base+"gathering magical energy, both hands drawing glowing power inward, winding up to cast."
        return base+"coiled and winding up, weapon or claws pulled back in anticipation just before striking."
    if fr=="a2":
        if k=="mage": return base+"unleashing a spell, staff raised with a burst of magic."
        if k=="beast": return base+"lunging forward to attack with open mouth or claws."
        return base+"swinging its weapon forward in a powerful striking blow."
    if fr=="a3":
        if k=="mage": return base+"follow-through after casting, arm extended forward, energy dissipating."
        if k=="beast": return base+"fully extended at the end of a lunge, having just struck, recovering."
        return base+"follow-through right after the attack, weapon swung past the body, off-balance and recovering."
    return base+"recoiling in pain from being hit, flinching and staggering backward, head snapped back, defensive."

def edit(slug, fr):
    src=base64.b64encode(open(f"src/assets/generated/{slug}.png","rb").read()).decode()
    content=[{"type":"text","text":prompt(slug,fr)},{"type":"image_url","image_url":{"url":f"data:image/png;base64,{src}"}}]
    body=json.dumps({"model":"google/gemini-2.5-flash-image","messages":[{"role":"user","content":content}],"modalities":["image","text"]}).encode()
    for _ in range(3):
        try:
            d=json.load(urllib.request.urlopen(urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",data=body,
                headers={"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}),timeout=180))
            imgs=d["choices"][0]["message"].get("images") or []
            if imgs:
                raw=f"{F}/{slug}_{fr}_raw.png"; open(raw,"wb").write(base64.b64decode(imgs[0]["image_url"]["url"].split(",",1)[1]))
                im=Image.open(raw).convert("RGBA");a=np.array(im);h,w=a.shape[:2]
                c=np.stack([a[0,0,:3],a[0,w-1,:3],a[h-1,0,:3],a[h-1,w-1,:3]]).astype(np.int16);bg=np.median(c,0)
                dist=np.sqrt(((a[...,:3].astype(np.int16)-bg)**2).sum(-1));a[...,3]=np.where(dist<115,0,255).astype(np.uint8)
                res=Image.fromarray(a,"RGBA");bb=res.getbbox();res=res.crop(bb) if bb else res
                if slug=="rogue": res=ImageOps.mirror(res)   # rogue is drawn facing left → flip to face right
                res.save(f"{F}/{slug}_{fr}.png"); return True, d.get("usage",{}).get("cost",0), res.size
        except Exception as e:
            print("  err",e,flush=True)
        time.sleep(2)
    return False,0,None

jobs=[(s,fr) for s in ALL for fr in ("a1","a2","a3","hurt") if not os.path.exists(f"{F}/{s}_{fr}.png")]
print(f"jobs: {len(jobs)}",flush=True)
total=0.0
for i,(s,fr) in enumerate(jobs,1):
    ok,cost,size=edit(s,fr); total+=cost
    print(f"[{i}/{len(jobs)}] {s}_{fr}: {'ok '+str(size) if ok else 'FAILED'} (total ${total:.3f})",flush=True)
print(f"DONE total ${total:.3f}",flush=True)
