#!/usr/bin/env node
// pnpm render <template> <spec.json> [--size 1600x900|1200x1200|1080x1350|2000x1000] [--engine html|satori] [--format png|svg] [--out path] [--scale 2] [--html debug.html] [--strict]
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { render, TEMPLATES } from './render.mjs';
import { closeBrowser } from './engines.mjs';
import { T } from './tokens.mjs';

const argv = process.argv.slice(2), pos = [], opt = {};
for (let i = 0; i < argv.length; i++) argv[i].startsWith('--') ? (opt[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i]) : pos.push(argv[i]);
const [tpl, specFile] = pos;
if (!tpl || !specFile || opt.help) {
  console.error(`usage: pnpm render <template> <spec.json> [--size ${Object.keys(T.sizes).join('|')}] [--engine html|satori] [--format png|svg] [--out path] [--scale 2] [--strict]\ntemplates: ${Object.keys(await TEMPLATES()).join(', ')}`);
  process.exit(tpl ? 0 : 1);
}
const specPath = resolve(process.env.INIT_CWD || process.cwd(), specFile);
// A bare .mmd file renders as { code } with defaults; a JSON spec may point at one with codeFile (relative to the spec).
const spec = specPath.endsWith('.mmd') ? { code: readFileSync(specPath, 'utf8') } : JSON.parse(readFileSync(specPath, 'utf8'));
if (spec.codeFile) spec.code = readFileSync(resolve(dirname(specPath), spec.codeFile), 'utf8');
const size = opt.size || '1600x900', engine = opt.engine || 'html', format = opt.format || 'png';
const out = resolve(process.env.INIT_CWD || process.cwd(), opt.out || `out/${tpl}-${size}-${engine}.${format}`);
try {
  const r = await render(tpl, spec, { size, engine, out, scale: opt.scale ? +opt.scale : undefined, htmlOut: opt.html, format });
  console.log(`wrote ${out} (${r.ms}ms, ${format === 'svg' ? 'svg' : engine}, ${size}${format === 'svg' ? '' : ` @${r.scale}x`})`);
  for (const n of r.notes || []) console.warn(`note: ${n}`);
  for (const w of r.warnings) console.warn(`warning: ${w}`);
  if (r.warnings.length && opt.strict) process.exitCode = 2;
} catch (e) { console.error(`error: ${e.message}`); process.exitCode = 1; }
finally { await closeBrowser(); }
