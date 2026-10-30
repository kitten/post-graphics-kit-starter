import { readFileSync } from 'node:fs';
export const ROOT = new URL('../', import.meta.url);
export const T = JSON.parse(readFileSync(new URL('tokens.json', ROOT), 'utf8'));
export const STYLE_NAMES = Object.keys(T.styles);

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b || {})) o[k] = isObj(v) && isObj(a?.[k]) ? merge(a[k], v) : v; return o; };

// font(roleKey) -> style fragment usable in both engines.
export function font(role) {
  const r = T.fonts.roles[role];
  if (!r) throw new Error(`unknown font role "${role}"`);
  const a = r.axes, fam = { tailrecursive: 'tailrecursive', inter: 'InterVar', 'jetbrains-mono': 'JBMonoVar' }[r.source];
  const fvs = Object.entries(a).filter(([k]) => k !== 'wght').map(([k, v]) => `"${k}" ${v}`).join(', ');
  return { fontFamily: fam, fontWeight: a.wght, html: { fontVariationSettings: fvs || 'normal', fontOpticalSizing: 'none' }, satori: { fontFamily: r.satoriFamily, fontWeight: 400 } };
}
// Merge a nested `html`/`satori` key safely when spreading several fragments.
export function sx(...parts) {
  const o = {};
  for (const p of parts) if (p) for (const [k, v] of Object.entries(p)) o[k] = (k === 'html' || k === 'satori') ? { ...(o[k] || {}), ...v } : v;
  return o;
}

// theme(spec): resolve spec.style (+ optional spec.mix: { section: otherStyle | {...} }) into one style object.
export function theme(spec, fallback) {
  const name = spec.style || fallback;
  if (!T.styles[name]) throw new Error(`unknown style "${name}" (have: ${STYLE_NAMES.join(', ')})`);
  let s = structuredClone(T.styles[name]);
  for (const [section, from] of Object.entries(spec.mix || {})) {
    if (typeof from === 'string') {
      if (!T.styles[from]) throw new Error(`mix.${section}: unknown style "${from}"`);
      s[section] = isObj(s[section]) ? merge(s[section], T.styles[from][section]) : structuredClone(T.styles[from][section]);
    } else s[section] = isObj(s[section]) ? merge(s[section], from) : from;
  }
  s.name = name;
  s.syntax = merge(T.syntax, s.syntax);
  s.f = role => font(s.fonts[role] || role);
  s.fontRole = role => s.fonts[role] || role;
  return s;
}
export const SIZE = key => { const z = T.sizes[key]; if (!z) throw new Error(`unknown size "${key}" (have: ${Object.keys(T.sizes).join(', ')})`); return z; };
