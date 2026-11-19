# Copies PNG (256 px) des illustrations, pour les écrans Alexa (APL ne garantit pas le WebP).
# Usage : python3 scripts/icons-png.py <dossier du site>  (crée <dossier>/icons-png/ à partir de <dossier>/icons/)
import os, sys
from PIL import Image
root = sys.argv[1]
src, dst = os.path.join(root, 'icons'), os.path.join(root, 'icons-png')
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if f.endswith('.webp') and not os.path.exists(os.path.join(dst, f[:-5] + '.png')):
        im = Image.open(os.path.join(src, f)).convert('RGBA')
        im.thumbnail((256, 256))
        im.save(os.path.join(dst, f[:-5] + '.png'), optimize=True)
