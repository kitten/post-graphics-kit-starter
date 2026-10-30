import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ROOT, SIZE, T } from './tokens.mjs';
import { renderHTML, renderSatori } from './engines.mjs';

let cache;
export async function TEMPLATES() {
  if (cache) return cache;
  cache = {};
  for (const f of readdirSync(new URL('templates/', ROOT)).filter(f => f.endsWith('.mjs'))) {
    const m = (await import(new URL('templates/' + f, ROOT))).default; cache[m.name] = m;
  }
  return cache;
}
// format: 'png' (default) | 'svg'. SVG = the template's own vector export when it has one (mermaid: raw themed
// Mermaid SVG), otherwise Satori's SVG of the whole card (text converted to paths, self-contained).
export async function render(name, spec, { size = '1600x900', engine = 'html', out, scale, htmlOut, format = 'png' }) {
  const tpl = (await TEMPLATES())[name];
  if (!tpl) throw new Error(`unknown template "${name}" (have: ${Object.keys(await TEMPLATES()).join(', ')})`);
  const errs = tpl.validate(spec);
  if (errs.length) throw new Error(`invalid ${name} spec:\n  - ${errs.join('\n  - ')}`);
  const z = SIZE(size), warnings = [], notes = [], ctx = { warn: m => warnings.push(m), note: m => notes.push(m), engine, format, size };
  spec = structuredClone(spec);
  const t = performance.now();
  if (tpl.prepare) await tpl.prepare(spec, z, ctx);
  if (format === 'svg' && tpl.svg) {
    mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, tpl.svg(spec, z, ctx));
    return { warnings, notes, ms: Math.round(performance.now() - t), scale: 1 };
  }
  const tree = tpl.render(spec, z, ctx);
  if (format === 'svg') {
    const r = await renderSatori(tree, z.w, z.h, out, { format: 'svg' });
    return { warnings: [...warnings, ...r.warnings], notes, ms: Math.round(performance.now() - t), scale: 1 };
  }
  const r = await (engine === 'satori' ? renderSatori : engine === 'html' ? renderHTML : () => { throw new Error(`unknown engine "${engine}"`); })(tree, z.w, z.h, out, { scale, htmlOut });
  return { warnings: [...warnings, ...r.warnings], notes: [...notes, ...(r.notes || [])], ms: Math.round(performance.now() - t), scale: scale || T.scale, minPx: r.minPx };
}
