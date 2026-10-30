// Text measurement on the static instances (same metrics both engines use), for fit-to-width + manual wrapping.
import opentype from 'opentype.js';
import { readFileSync, existsSync } from 'node:fs';
import { T, ROOT } from './tokens.mjs';
const cache = {};
function load(file) {
  if (!(file in cache)) { const p = new URL('fonts/static/' + file, ROOT); cache[file] = existsSync(p) ? opentype.parse(readFileSync(p).buffer) : null; }
  return cache[file];
}
function fontsFor(role) {
  const fam = T.fonts.roles[role].satoriFamily;
  return ['latin', 'latin-ext', 'all', 'greek', 'full'].map(s => load(`${fam}-${s}.ttf`)).filter(Boolean);
}
export function textWidth(text, role, size, tracking = 0) {
  const fs = fontsFor(role); let w = 0;
  for (const ch of text) {
    const f = fs.find(f => f.charToGlyph(ch).index !== 0) || fs[0];
    w += (f.charToGlyph(ch).advanceWidth || 0) * size / f.unitsPerEm + tracking;
  }
  return w;
}
// Greedy word wrap; explicit "\n" forces a break. Returns lines.
export function wrap(text, role, size, maxW, tracking = 0) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const t = line ? line + ' ' + word : word;
      if (line && textWidth(t, role, size, tracking) > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
// Largest size <= max (step 2px) where text fits maxW in <= maxLines lines and no single word overflows.
export function fit(text, role, { max, min = 24, maxW, maxLines = 3, tracking = 0 }) {
  for (let size = max; size >= min; size -= 2) {
    const tr = tracking * size, lines = wrap(text, role, size, maxW, tr);
    if (lines.length <= maxLines && lines.every(l => textWidth(l, role, size, tr) <= maxW)) return { size, lines };
  }
  const tr = tracking * min;
  return { size: min, lines: wrap(text, role, min, maxW, tr), overflow: true };
}
