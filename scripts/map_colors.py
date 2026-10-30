"""Map sampled diagram colours onto kitten/system lib/colors.nix (CIEDE2000). Adopt nix colour if dE<=12."""
import json, re, sys
from coloraide import Color
nix = dict(re.findall(r'(\w+) = "([0-9A-Fa-f]{6})";', open(sys.argv[1]).read()))
roles = {
 'node.fill':'#21212b','node.border':'#5452f6','node.text':'#ffffff',
 'local.fill':'#032607','local.border':'#49b159','local.text':'#49b159',
 'conflict.fill':'#430c06','conflict.border':'#f4746c','conflict.text':'#f4746c',
 'path.fill':'#0e1a2a','path.border':'#2097f6','path.text':'#2097f6',
 'badge.fill':'#de1306','badge.text':'#ffffff','lines':'#5452f6','arrow':'#5452f6',
 'hairline':'#2a2a36','text.muted':'#909095'}
TH=12
out={}
for role,s in roles.items():
  best=min(nix.items(), key=lambda kv: Color(s).delta_e(Color('#'+kv[1]),method='2000'))
  d=Color(s).delta_e(Color('#'+best[1]),method='2000')
  use='#'+best[1].lower() if d<=TH else s
  out[role]={'sampled':s,'nearest':f'{best[0]} #{best[1].lower()}','dE2000':round(d,1),'use':use,'source':'colors.nix' if d<=TH else 'sampled'}
  print(f'{role:16} sampled {s}  nearest {best[0]:11} #{best[1].lower()}  dE {d:5.1f}  -> {use} ({out[role]["source"]})')
json.dump({'nix':{k:'#'+v.lower() for k,v in nix.items()},'roles':out},open(sys.argv[2],'w'),indent=2)
