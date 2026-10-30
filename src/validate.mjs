// Tiny spec validator: returns a list of human-readable errors.
import { STYLE_NAMES, T } from './tokens.mjs';
export function check(spec, rules) {
  const e = [];
  if (!spec || typeof spec !== 'object') return ['spec must be a JSON object'];
  if (spec.style && !STYLE_NAMES.includes(spec.style)) e.push(`style must be one of ${STYLE_NAMES.join(', ')}`);
  for (const [sec, from] of Object.entries(spec.mix || {})) {
    if (!(sec in T.styles.kitten) && sec !== 'syntax') e.push(`mix.${sec}: not a style section (${Object.keys(T.styles.kitten).join(', ')})`);
    if (typeof from === 'string' && !STYLE_NAMES.includes(from)) e.push(`mix.${sec}: unknown style "${from}"`);
  }
  for (const [key, test, msg] of rules) { try { if (!test(spec[key], spec)) e.push(`${key}: ${msg}`); } catch { e.push(`${key}: ${msg}`); } }
  return e;
}
export const str = v => typeof v === 'string' && v.trim().length > 0;
export const optStr = v => v === undefined || v === null || typeof v === 'string';
export const num = v => typeof v === 'number' && Number.isFinite(v);
export const optPill = v => v === undefined || v === null || typeof v === 'string' || (typeof v === 'object' && str(v.text));
