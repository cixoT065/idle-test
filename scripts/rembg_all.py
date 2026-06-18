import glob, os, warnings
warnings.filterwarnings("ignore")
from rembg import remove, new_session
from PIL import Image

session = new_session("u2net")
for raw in sorted(glob.glob("src/assets/generated/*_raw.png")):
    out = raw.replace("_raw.png", ".png")
    im = Image.open(raw).convert("RGBA")
    res = remove(im, session=session)           # AI foreground segmentation
    bbox = res.getbbox()
    if bbox: res = res.crop(bbox)
    res.save(out)
    print(f"{os.path.basename(out):22} {res.size}", flush=True)
print("DONE")
