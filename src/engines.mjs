import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, ROOT } from './tokens.mjs';
import { toHTML, toSatori } from './h.mjs';

const STATIC = new URL('fonts/static/', ROOT);
let satoriFonts, faceCSS, browser;

function loadSatoriFonts() {
  if (satoriFonts) return satoriFonts;
  const files = readdirSync(STATIC).filter(f => f.endsWith('.ttf'));
  if (!files.length) throw new Error('fonts/static is empty: run `pnpm fonts`');
  // latin first so it wins for basic glyphs; other subsets act as fallback.
  const rank = f => ['latin.', 'latin-ext', 'full', 'all', 'greek'].findIndex(s => f.includes('-' + s));
  files.sort((a, b) => rank(a) - rank(b));
  return (satoriFonts = files.map(f => ({ name: f.replace(/-(latin-ext|latin|greek|all|full)\.ttf$/, ''), data: readFileSync(new URL(f, STATIC)), weight: 400, style: 'normal' })));
}
export function htmlFaces() {
  if (faceCSS) return faceCSS;
  const fam = { tailrecursive: 'tailrecursive', inter: 'InterVar', 'jetbrains-mono': 'JBMonoVar' };
  const mime = f => f.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
  return (faceCSS = Object.entries(T.fonts.htmlFaces).flatMap(([src, faces]) => faces.map(fc =>
    `@font-face{font-family:${fam[src]};src:url(data:${mime(fc.file)};base64,${readFileSync(new URL('fonts/' + fc.file, ROOT)).toString('base64')});font-weight:100 1000;font-style:normal;${fc.unicodeRange ? `unicode-range:${fc.unicodeRange};` : ''}}`)).join('\n'));
}

export async function renderSatori(tree, W, H, out, { scale = T.scale, format = 'png' } = {}) {
  const { default: satori } = await import('satori');
  const { Resvg } = await import('@resvg/resvg-js');
  const svg = await satori(toSatori(tree), { width: W, height: H, fonts: loadSatoriFonts() });
  if (format === 'svg') { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, svg); return { warnings: [] }; }
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * scale }, font: { loadSystemFonts: false } }).render().asPng();
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, png);
  return { warnings: [] };
}

export async function getBrowser() {
  if (browser) return browser;
  const { chromium } = await import('playwright');
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  try { browser = await chromium.launch(opts); }
  catch (e) {
    if (!opts.executablePath && existsSync('/usr/bin/google-chrome')) browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
    else throw new Error(`Chromium not available. Run \`pnpm browser:install\` (or set CHROME_PATH).\n${e.message}`);
  }
  return browser;
}
export async function closeBrowser() { if (browser) await browser.close(); browser = undefined; }

export async function renderHTML(tree, W, H, out, { scale = T.scale, htmlOut } = {}) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${htmlFaces()}*{box-sizing:border-box;margin:0;padding:0}body{width:${W}px;height:${H}px;overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}</style></head><body>${toHTML(tree)}</body></html>`;
  if (htmlOut) writeFileSync(htmlOut, doc);
  await page.setContent(doc, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Self-check: text that leaves the canvas or overflows its box.
  const { w: warnings, notes, minPx } = await page.evaluate(([W, H, REF, MIN, WARN, SHARE]) => {
    const w = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (b.left < -1 || b.top < -1 || b.right > W + 1 || b.bottom > H + 1) { w.push(`text off-canvas: "${n.textContent.slice(0, 40)}"`); break; }
      const el = n.parentElement;
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') w.push(`text clipped: "${n.textContent.slice(0, 40)}"`);
    }
    // Legibility: effective font px (after any CSS/SVG scaling), normalised to a 1600px-wide canvas.
    // Elements can opt out with the CSS custom property --nl:1 (placeholder stamp, decorative text).
    const norm = REF / W, sizes = [];
    const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker2.nextNode());) {
      const t = n.textContent.trim(); if (!t) continue;
      const el = n.parentElement;
      if (!el || /^(style|script|title|desc|defs|marker)$/i.test(el.tagName) || el.closest('defs,marker,style')) continue;
      const cs = getComputedStyle(el);
      if (cs.getPropertyValue('--nl').trim() === '1' || cs.visibility === 'hidden' || cs.display === 'none') continue;
      let k = 1;
      if (el instanceof SVGElement) { if (!el.getScreenCTM) continue; const m = el.getScreenCTM(); k = m ? Math.hypot(m.a, m.b) : 1; }
      else { const r = el.getBoundingClientRect(); if (el.offsetWidth > 0 && r.width > 0) k = r.width / el.offsetWidth; }
      sizes.push({ px: parseFloat(cs.fontSize) * k * norm, t, chars: t.length });
    }
    const tiny = sizes.filter(s => s.px < MIN - 0.25), small = sizes.filter(s => s.px < WARN);
    const total = sizes.reduce((a, s) => a + s.chars, 0) || 1, smallShare = small.reduce((a, s) => a + s.chars, 0) / total;
    const minPx = sizes.length ? Math.min(...sizes.map(s => s.px)) : null;
    if (tiny.length) w.push(`legibility: ${tiny.length} text run(s) below ${MIN}px effective (smallest ${minPx.toFixed(1)}px, e.g. "${tiny[0].t.slice(0, 30)}") — illegible on a phone. Use a larger/taller size (1080x1350, 2000x1000), cut content, or split into a thread of images`);
    const notes = [];
    if (!tiny.length && smallShare > SHARE) notes.push(`legibility: ${Math.round(smallShare * 100)}% of the text is below ${WARN}px effective — readable when tapped, small in the feed. Consider a larger size or splitting`);
    return { w: [...new Set(w)], notes, minPx };
  }, [W, H, T.legibility.refWidth, T.legibility.minPx, T.legibility.warnPx, T.legibility.denseShareMax]);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, scale: 'device' });
  await page.close();
  return { warnings, notes, minPx };
}
export const outPath = p => p instanceof URL ? fileURLToPath(p) : p;
