#!/usr/bin/env python3
"""Rebuild fonts/static/*.ttf (static instances for Satori) from the variable fonts.
Usage: python3 scripts/build-fonts.py   (needs: pip install fonttools brotli)
HTML rendering uses the variable files directly; Satori cannot, so every axis
combination used by tokens.json -> fonts.roles needs a static instance here."""
import json, os, glob, re
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tokens = json.load(open(os.path.join(ROOT, 'tokens.json')))
GOOGLE = '/usr/share/fonts/truetype/sand-box/google'
SOURCES = {
  'tailrecursive': sorted(glob.glob(os.path.join(ROOT, 'fonts/variable/tailrecursive-subset-*.woff2'))),
  'inter': [os.path.join(ROOT, 'fonts/variable/Inter-VariableFont_opsz,wght.ttf')],
  'jetbrains-mono': [os.path.join(ROOT, 'fonts/variable/JetBrainsMono-VariableFont_wght.ttf')],
}
out = os.path.join(ROOT, 'fonts/static'); os.makedirs(out, exist_ok=True)
for f in glob.glob(os.path.join(out, '*.ttf')): os.remove(f)
for role, r in tokens['fonts']['roles'].items():
  for i, src in enumerate(SOURCES[r['source']]):
    f = TTFont(src)
    axes = {a.axisTag: a for a in f['fvar'].axes}
    loc = {t: max(axes[t].minValue, min(axes[t].maxValue, v)) for t, v in r['axes'].items() if t in axes}
    for t, a in axes.items(): loc.setdefault(t, a.defaultValue)
    inst = instantiateVariableFont(f, loc, updateFontNames=False)
    inst.flavor = None
    m = re.search(r'subset-([a-z-]+)\.woff2$', src)
    name = f"{r['satoriFamily']}-{m.group(1) if m else 'full'}.ttf"
    inst.save(os.path.join(out, name))
    print(role, '->', name, loc)
