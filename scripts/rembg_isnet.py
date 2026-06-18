import glob, os, warnings
warnings.filterwarnings("ignore")
from rembg import remove, new_session
from PIL import Image
session = new_session("isnet-general-use")
for raw in sorted(glob.glob("src/assets/generated/*_raw.png")):
    out = raw.replace("_raw.png", ".png")
    im = Image.open(raw).convert("RGBA")
    res = remove(im, session=session, post_process_mask=True)
    bbox = res.getbbox()
    if bbox: res = res.crop(bbox)
    res.save(out)
    # report how much was kept (lower = more bg removed)
    import numpy as np
    a = np.array(Image.open(out)); kept = (a[...,3] > 10).mean()
    print(f"{os.path.basename(out):22} {res.size} kept={kept:.2f}", flush=True)
print("DONE")
