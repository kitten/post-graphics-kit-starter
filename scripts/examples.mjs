#!/usr/bin/env node
// pnpm examples [--satori] [--only name,name]
// Renders every examples/specs/<template>[-variant].json at both sizes, then composes examples/sheet.png.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render } from '../src/render.mjs';
import { getBrowser, closeBrowser } from '../src/engines.mjs';
import { T, ROOT } from '../src/tokens.mjs';

const dir = p => fileURLToPath(new URL(p, ROOT));
const CSS = `body{margin:0;background:#050607;color:#beb29e;font:15px/1.3 ui-monospace,monospace;padding:40px;width:2520px}
  h1{color:#edf0f2;font:700 30px system-ui,sans-serif;margin:0 0 6px} p{margin:0 0 28px}
  .g{display:grid;gap:28px 24px;margin-bottom:36px;align-items:start} figure{margin:0} img{display:block;border-radius:10px;outline:1px solid #242738}
  figcaption{margin-top:8px} b{color:#d7c046}`;
const b64 = p => 'data:image/png;base64,' + readFileSync(p).toString('base64');
const fig = (i, w) => { const [W, H] = i.size.split('x').map(Number); return `<figure><img src="${b64(i.out)}" style="width:${w}px;height:${w * H / W}px"><figcaption><b>${i.name}</b> · ${i.style} · ${i.size}</figcaption></figure>`; };


const args = process.argv.slice(2), satori = args.includes('--satori');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const ORDER = ['diagram', 'title', 'stat', 'compare', 'code', 'mermaid', 'bars', 'line', 'table'];
const specs = readdirSync(dir('examples/specs/')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5))
  .filter(n => !only || only.includes(n))
  .sort((a, b) => ORDER.indexOf(a.split('-')[0]) - ORDER.indexOf(b.split('-')[0]) || a.length - b.length || a.localeCompare(b));
mkdirSync(dir('examples/out/satori/'), { recursive: true });
const done = []; let warned = 0;
try {
  for (const name of specs) {
    const tpl = name.split('-')[0], spec = JSON.parse(readFileSync(dir(`examples/specs/${name}.json`), 'utf8'));
    for (const size of spec.exampleSizes || ['1600x900', '1200x1200']) for (const engine of satori ? ['html', 'satori'] : ['html']) {
      const out = dir(`examples/out/${engine === 'satori' ? 'satori/' : ''}${name}-${size}.png`);
      const r = await render(tpl, spec, { size, engine, out });
      console.log(`${name.padEnd(20)} ${size.padEnd(9)} ${engine.padEnd(6)} ${String(r.ms).padStart(6)}ms`);
      for (const n of r.notes || []) console.warn(`  note: ${n}`);
      for (const w of r.warnings) { warned++; console.warn(`  warning: ${w}`); }
      if (engine === 'html') done.push({ name, size, dense: spec.sheet === 'dense', style: spec.style + (spec.mix ? ' + mix ' + JSON.stringify(spec.mix).replace(/[{}"]/g, '') : ''), out });
    }
  }
  if (!only) { await sheet(done.filter(i => !i.dense)); await sheetDense(done.filter(i => i.dense)); }
} finally { await closeBrowser(); }
if (warned) process.exitCode = 2;

async function shoot(html, file, width) {
  const page = await (await getBrowser()).newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: dir(file), fullPage: true });
  await page.close();
  console.log(`wrote ${file}`);
}
// Dense sheet: every dense/data/mermaid spec — landscape sizes in a 3-wide grid, portrait/square in a 5-wide grid.
async function sheetDense(items) {
  if (!items.length) return;
  const land = items.filter(i => { const [W, H] = i.size.split('x').map(Number); return W > H; }), tall = items.filter(i => !land.includes(i));
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style>
    <h1>graphics-kit — dense / data / mermaid sheet</h1><p>PLACEHOLDER data and structure for layout testing only. HTML engine. Templates: ${[...new Set(items.map(i => i.name.split('-')[0]))].join(', ')}. Styles: ${[...new Set(items.map(i => i.style.split(' ')[0]))].join(', ')}.</p>
    <div class="g" style="grid-template-columns:repeat(3,808px)">${land.map(i => fig(i, 808)).join('')}</div>
    <div class="g" style="grid-template-columns:repeat(5,472px)">${tall.map(i => fig(i, 472)).join('')}</div>`;
  writeFileSync(dir('examples/out/sheet-dense.html'), html);
  await shoot(html, 'examples/sheet-dense.png', 2600);
}

async function sheet(items) {
  // All 1600x900 renders in a 3-wide grid, then the 1200x1200 renders of each base template.
  const wide = items.filter(i => i.size === '1600x900'), square = items.filter(i => i.size === '1200x1200' && !i.name.includes('-'));
  const b64 = p => 'data:image/png;base64,' + readFileSync(p).toString('base64');
  const card = (i, w, h) => `<figure><img src="${b64(i.out)}" style="width:${w}px;height:${h}px"><figcaption><b>${i.name.split('-')[0]}</b> · ${i.style} · ${i.size}</figcaption></figure>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#050607;color:#beb29e;font:15px/1.3 ui-monospace,monospace;padding:40px;width:2520px}
    h1{color:#edf0f2;font:700 30px system-ui,sans-serif;margin:0 0 6px} p{margin:0 0 28px}
    .g{display:grid;gap:28px 24px;margin-bottom:36px} figure{margin:0} img{display:block;border-radius:10px;outline:1px solid #242738}
    figcaption{margin-top:8px} b{color:#d7c046}</style>
    <h1>graphics-kit — example sheet</h1><p>All specs are PLACEHOLDER data for layout testing. HTML engine (source of truth). Styles: ${[...new Set(items.map(i => i.style.split(' ')[0]))].join(', ')}.</p>
    <div class="g" style="grid-template-columns:repeat(3,808px)">${wide.map(i => card(i, 808, 454.5)).join('')}</div>
    <div class="g" style="grid-template-columns:repeat(5,472px)">${square.map(i => card(i, 472, 472)).join('')}</div>`;
  writeFileSync(dir('examples/out/sheet.html'), html);
  const page = await (await getBrowser()).newPage({ viewport: { width: 2600, height: 1000 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: dir('examples/sheet.png'), fullPage: true });
  await page.close();
  console.log('wrote examples/sheet.png');
}
