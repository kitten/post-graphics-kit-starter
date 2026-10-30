// Mermaid diagram inside the kit's card frame. Any Mermaid type; themed per kit style; ELK layout for big flowcharts.
// Browser (html) engine only. `--format svg` exports the raw themed Mermaid SVG (no card) for blogs/docs.
import { h, raw } from '../src/h.mjs';
import { theme, T } from '../src/tokens.mjs';
import { card, bestSize } from '../src/card.mjs';
import { renderMermaid, sizedSVG, diagramKind } from '../src/mermaid.mjs';
import { check, str, optStr } from '../src/validate.mjs';

const FS = 22;
const code = spec => Array.isArray(spec.code) ? spec.code.join('\n') : spec.code;
const validate = spec => check(spec, [
  ['code', v => str(Array.isArray(v) ? v.join('\n') : v), 'Mermaid source: a string or an array of lines (or codeFile: path, CLI only)'],
  ['layout', v => v === undefined || ['auto', 'elk', 'dagre', 'elk.stress', 'elk.force', 'elk.mrtree'].includes(v), 'auto | elk | dagre | elk.stress | elk.force | elk.mrtree'],
  ['look', v => v === undefined || ['classic', 'neo', 'handDrawn'].includes(v), 'classic | neo | handDrawn'],
  ['fontSize', v => v === undefined || (typeof v === 'number' && v >= 12 && v <= 32), '12–32 (Mermaid base px before fitting)'],
  ['legend', v => v === undefined || (Array.isArray(v) && v.every(i => str(i.label))), '[{ label, kind | color }]'],
  ['title', optStr, 'string'], ['subtitle', optStr, 'string'], ['source', optStr, 'string'], ['caption', optStr, 'string'],
]);

async function prepare(spec, z, ctx) {
  if (ctx.engine === 'satori' && ctx.format !== 'svg') throw new Error('mermaid needs the browser engine (--engine html); Satori cannot lay out Mermaid');
  const th = theme(spec, 'kitten'), src = code(spec);
  // These render, but Mermaid's auto-layout makes them look generic; the hand-placed diagram template reads far better.
  const AVOID = { flowchart: 'flowchart/graph', class: 'classDiagram', mindmap: 'mindmap' }, kind = diagramKind(src);
  if (AVOID[kind]) ctx.warn(`mermaid ${AVOID[kind]} is on the avoid list (auto-layout looks generic). Use the diagram template instead (hand-placed nodes, groups, edges; "dense": true for big ones). Rendering anyway.`);
  // Flowcharts: try both main directions and both layout engines (unless pinned) and keep the one that fits this
  // canvas at the largest scale. Other diagram types render once.
  const dir = /^(\s*(?:flowchart|graph)\s+)(LR|RL|TB|TD|BT)\b/m.exec(src);
  const layouts = !dir || (spec.layout && spec.layout !== 'auto') ? [spec.layout || 'auto'] : ['dagre', 'elk'];
  const dirs = dir && spec.fitDirection !== false && ctx.format !== 'svg' ? [dir[2], /^(LR|RL)$/.test(dir[2]) ? 'TB' : 'LR'] : [dir?.[2]];
  const { box } = card(th, spec, z, { warn() {}, note() {} }, { legend: spec.legend });
  const base = { look: spec.look, fontSize: spec.fontSize ?? FS, config: spec.config, fit: ctx.format === 'svg' ? undefined : box };
  const sc = m => Math.min(box.w / m.w, box.h / m.h);
  let best;
  for (const d of dirs) for (const layout of layouts) {
    const m = await renderMermaid(d && d !== dir[2] ? src.replace(dir[0], dir[1] + d) : src, th, { ...base, layout });
    m.dir = d; if (!best || sc(m) > sc(best) * 1.05) best = m;
  }
  if (dir && best.dir !== dir[2]) ctx.note(`rendered as flowchart ${best.dir} because it fits this canvas larger than ${dir[2]}; set "fitDirection": false to keep ${dir[2]}`);
  spec.__m = best;
}

function svg(spec) {
  // Raw export: themed SVG at natural size with the style background; fonts referenced by name with fallbacks.
  const th = theme(spec, 'kitten'), m = spec.__m;
  return sizedSVG(m.svg, m.w, m.h).replace('style="display:block;overflow:visible"', `style="background:${th.bg}"`);
}

function render(spec, z, ctx) {
  const th = theme(spec, 'kitten'), m = spec.__m, { w: W } = z;
  const { box, wrap } = card(th, spec, z, ctx, { legend: spec.legend });
  const s = Math.min(box.w / m.w, box.h / m.h, spec.maxScale ?? 1.6);
  const eff = (spec.fontSize ?? FS) * s * T.legibility.refWidth / W, w = m.w * s, hh = m.h * s;
  if (eff < T.legibility.warnPx) {
    const b = bestSize(m.w, m.h), bEff = (spec.fontSize ?? FS) * b.s;
    const better = b.key !== ctx.size && bEff > eff * 1.12 ? ` Try --size ${b.key} (≈${bEff.toFixed(0)}px).` : '';
    (eff < T.legibility.minPx ? ctx.warn : ctx.note)(`mermaid ${m.kind}: labels land at ≈${eff.toFixed(1)}px effective (scale ${s.toFixed(2)}×).${better} Otherwise cut nodes or split into a thread of images (one subgraph per image).`);
  }
  const x = box.x + (box.w - w) / 2, y = box.y + (box.h - hh) / 2;
  return wrap([raw(sizedSVG(m.svg, w, hh), { position: 'absolute', left: x, top: y, width: w, height: hh })]);
}

export default { name: 'mermaid', describe: 'Mermaid sequence, state, ER, gantt, timeline, xychart, sankey… (flowchart, class and mindmap render but are on the avoid list: use the diagram template) themed per kit style, in the card frame. html engine; --format svg = raw themed SVG.', validate, prepare, render, svg };
