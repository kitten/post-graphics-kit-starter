// Hand-placed box diagram (max 5 boxes; dense: true allows up to 24 plus groups and a legend). Positions are grid units in the spec; the kit scales to fit.
import { h, img } from '../src/h.mjs';
import { theme, sx, T } from '../src/tokens.mjs';
import { textWidth, fit } from '../src/measure.mjs';
import { frame, svgURI, titleLines } from '../src/frame.mjs';
import { legendRow } from '../src/card.mjs';
import { check, str, num } from '../src/validate.mjs';

const KINDS = ['normal', 'header', 'local', 'conflict', 'path'];
const EDGES = ['tree', 'arrow', 'curve'];

function validate(spec) {
  const ids = new Set((spec.nodes || []).map(n => n.id));
  return check(spec, [
    ['nodes', v => Array.isArray(v) && v.length >= 1, 'needs 1–5 nodes'],
    ['nodes', (v, s) => v.length <= (s.dense ? 24 : 5), 'style rule: at most 5 boxes (set dense: true for up to 24, or split into two graphics / use the mermaid template)'],
    ['groups', (v, s) => v === undefined || (s.dense && v.every(g => str(g.label) && Array.isArray(g.nodes) && g.nodes.every(id => ids.has(id)))), 'groups need dense: true and [{ label, nodes: [ids], kind? }]'],
    ['legend', v => v === undefined || (Array.isArray(v) && v.every(l => str(l.label))), '[{ label, kind } | { label, color }]'],
    ['nodes', v => v.every(n => str(n.id) && str(n.label) && num(n.x) && num(n.y)), 'every node needs id, label, x, y (grid units)'],
    ['nodes', v => v.every(n => !n.kind || KINDS.includes(n.kind)), `kind must be one of ${KINDS.join(', ')}`],
    ['nodes', v => ids.size === v.length, 'node ids must be unique'],
    ['edges', v => v === undefined || v.every(e => ids.has(e.from) && ids.has(e.to)), 'edges must reference existing node ids'],
    ['edges', v => v === undefined || v.every(e => !e.type || EDGES.includes(e.type)), `edge type must be one of ${EDGES.join(', ')}`],
  ]);
}

function render(spec, { w: W, h: H, pad }, ctx) {
  const th = theme(spec, 'kitten'), D = th.diagram, sq = H / W > 0.9;
  const colU = spec.grid?.col ?? 76, rowU = spec.grid?.row ?? (sq ? 100 : 86);

  // Header
  let headerH = 0; const head = [];
  if (spec.eyebrow) { head.push(h('div', sx(th.f('label'), { fontSize: 22, color: th.text.code, letterSpacing: 1, marginBottom: 14 }), (th.decor?.prompt ? th.decor.prompt + ' ' : '') + spec.eyebrow)); headerH += 22 + 14; }
  if (spec.title) {
    const ft = fit(spec.title, th.fontRole('display'), { max: sq ? 68 : 60, min: 34, maxW: W - pad * 2, maxLines: 2, tracking: -0.015 });
    if (ft.overflow) ctx.warn('title does not fit in 2 lines; shorten it');
    head.push(titleLines(th, th.fontRole('display'), ft, { lineHeight: 1.05, tracking: -0.015 })); headerH += ft.lines.length * ft.size * 1.05;
  }
  const top = (head.length ? pad * (sq ? 1.1 : 0.85) + headerH + (sq ? 70 : 48) : pad);
  const bottom = (spec.caption ? 110 : 90) + (sq ? 30 : 0) + (spec.legend ? 50 : 0);

  const layout = s => {
    const fs = (spec.dense ? 24 : 30) * s, nh = (spec.dense ? 52 : 64) * s, padX = (spec.dense ? 18 : 22) * s, bw = 2.5 * s;
    const nodes = spec.nodes.map(n => {
      const role = n.kind === 'header' ? th.fontRole('nodeStrong') : n.mono ? th.fontRole('mono') : th.fontRole('node');
      const w = Math.max(textWidth(n.label, role, fs) + padX * 2 + bw * 2, (n.minW || 0) * colU * s);
      return { ...n, kind: n.kind || 'normal', role, x: n.x * colU * s, y: n.y * rowU * s, w, nh };
    });
    const by = Object.fromEntries(nodes.map(n => [n.id, n]));
    let maxX = Math.max(...nodes.map(n => n.x + n.w)), maxY = Math.max(...nodes.map(n => n.y + nh));
    for (const e of spec.edges || []) if (e.type === 'curve') maxX = Math.max(maxX, Math.max(by[e.from].x + by[e.from].w, by[e.to].x + by[e.to].w) + 130 * s + (e.label ? textWidth(e.label, th.fontRole('label'), 18 * s) : 0));
    const gp = 18 * s, gl = 34 * s;
    const groups = (spec.groups || []).map(g => {
      const m = g.nodes.map(id => by[id]);
      return { ...g, x: Math.min(...m.map(n => n.x)) - gp, y: Math.min(...m.map(n => n.y)) - gp - gl, x2: Math.max(...m.map(n => n.x + n.w)) + gp, y2: Math.max(...m.map(n => n.y + nh)) + gp };
    });
    for (const g of groups) { maxX = Math.max(maxX, g.x2); maxY = Math.max(maxY, g.y2); }
    const minX = Math.min(0, ...groups.map(g => g.x));
    const minY = Math.min(0, ...nodes.filter(n => n.badge).map(n => n.y - 18 * s), ...groups.map(g => g.y));
    return { s, fs, nh, padX, bw, nodes, by, groups, gl, bw_: maxX - minX, bh: maxY - minY, minY, minX };
  };
  const L1 = layout(1), availW = W - pad * 2, availH = H - top - bottom;
  const s = Math.min(availW / L1.bw_, availH / L1.bh, spec.maxScale ?? 1.5);
  const eff = (spec.dense ? 24 : 30) * s * 1600 / W;
  if (eff < T.legibility.minPx) ctx.warn(`diagram labels ${eff.toFixed(1)}px effective — illegible on a phone; use fewer nodes, a bigger size (2000x1000 / 1080x1350), the mermaid template, or split into a thread`);
  else if (s < 0.8) ctx.note(`diagram scaled down to ${s.toFixed(2)}× (labels ${eff.toFixed(1)}px effective)`);
  const L = layout(s), X0 = pad + (availW - L.bw_) / 2 - L.minX, Y0 = top + (availH - L.bh) / 2 - L.minY;
  for (const n of [...L.nodes, ...L.groups]) { n.x += X0; n.y += Y0; if (n.x2 !== undefined) { n.x2 += X0; n.y2 += Y0; } }

  const lw = 3 * s, chevron = (x, y, dir, c) => `<path d="M${x - dir * 12 * s} ${y - 10 * s} L${x} ${y} L${x - dir * 12 * s} ${y + 10 * s}" fill="none" stroke="${c}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let paths = ''; const labels = [];
  // Edge labels take the first candidate spot that clears nodes, group borders and earlier labels; if none does,
  // the first spot gets a background-coloured halo so crossing lines don't run through the text.
  const placed = [], lfs = 18 * s, lh = lfs * 1.3;
  const hits = r => {
    const ov = (b, pad = 4 * s) => r.x < b.x2 + pad && r.x2 > b.x - pad && r.y < b.y2 + pad && r.y2 > b.y - pad;
    if (L.nodes.some(n => ov({ x: n.x, y: n.y, x2: n.x + n.w, y2: n.y + L.nh }))) return true;
    if (L.groups.some(g => ov(g) && !(r.x > g.x + 8 * s && r.x2 < g.x2 - 8 * s && r.y > g.y + 8 * s && r.y2 < g.y2 - 8 * s))) return true;
    return placed.some(b => ov(b)) || r.x < 0 || r.x2 > W;
  };
  const label = (cands, text) => {
    const tw = textWidth(text, th.fontRole('label'), lfs);
    const rects = cands.map(([x, y, anchor = 'left']) => { const l = anchor === 'center' ? x - tw / 2 : anchor === 'right' ? x - tw : x; return { x: l, y, x2: l + tw, y2: y + lh }; });
    const ok = rects.find(r => !hits(r)), r = ok || rects[0];
    placed.push(r);
    labels.push(h('div', sx(th.f('label'), { position: 'absolute', left: r.x, top: r.y, fontSize: lfs, color: th.text.code, whiteSpace: 'nowrap',
      ...(ok ? {} : { background: th.bg, padding: `0 ${4 * s}px`, marginLeft: -4 * s, borderRadius: 4 * s }) }), text));
  };
  for (const e of spec.edges || []) {
    const a = L.by[e.from], b = L.by[e.to], type = e.type || 'tree';
    const c = e.tone === 'accent' ? th.text.accent : type === 'tree' ? D.lines : D.arrow;
    const dash = e.dashed ?? type === 'curve' ? `stroke-dasharray="${7 * s} ${7 * s}"` : '';
    if (type === 'tree') {
      const tx = a.x + (e.trunk ?? 38) * s;
      paths += `<path d="M${tx} ${a.y + L.nh} V${b.y + L.nh / 2} H${b.x}" fill="none" stroke="${c}" stroke-width="${lw}" ${dash}/>`;
      if (e.label) label([[tx + 10 * s, (a.y + L.nh + b.y + L.nh / 2) / 2 - 12 * s]], e.label);
    } else if (type === 'arrow') {
      const x1 = a.x + a.w + 6 * s, y1 = a.y + L.nh / 2, x2 = b.x - 8 * s, y2 = b.y + L.nh / 2, mx = (x1 + x2) / 2;
      paths += `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" fill="none" stroke="${c}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" ${dash}/>` + chevron(x2, y2, 1, c);
      paths += `<circle cx="${x1}" cy="${y1}" r="${5 * s}" fill="${c}"/>`;
      if (e.label) label(Math.abs(y2 - y1) < 2 ? [[mx, y1 - 34 * s, 'center']] : [[mx + 12 * s, (y1 + y2) / 2 - 12 * s], [mx - 12 * s, (y1 + y2) / 2 - 12 * s, 'right'],
        [(x1 + mx) / 2, y1 + (y2 > y1 ? -34 : 8) * s, 'center'], [(mx + x2) / 2, y2 + (y2 > y1 ? 8 : -34) * s, 'center'], [(mx + x2) / 2, y2 - (y2 > y1 ? 34 : -8) * s, 'center']], e.label);
    } else {
      const x1 = a.x + a.w + 10 * s, y1 = a.y + L.nh / 2, x2 = b.x + b.w + 14 * s, y2 = b.y + L.nh / 2, cx = Math.max(x1, x2) + 110 * s;
      paths += `<path d="M${x1} ${y1} C${cx} ${y1}, ${cx} ${y2}, ${x2 + 6 * s} ${y2}" fill="none" stroke="${c}" stroke-width="${lw}" ${dash} stroke-linecap="round"/>`;
      paths += `<circle cx="${x1}" cy="${y1}" r="${5 * s}" fill="${c}"/>` + chevron(x2 + 6 * s, y2, -1, c);
      if (e.label) label([[cx - 18 * s, (y1 + y2) / 2 - 12 * s]], e.label);
    }
  }
  const overlay = img(svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paths}</svg>`), { position: 'absolute', left: 0, top: 0, width: W, height: H });

  const G = th.diagram.group || { fill: 'rgba(255,255,255,0.04)', border: th.hairline, text: th.text.small };
  const groupEl = g => {
    const r = g.kind ? D[g.kind] : null;
    return h('div', { position: 'absolute', left: g.x, top: g.y, width: g.x2 - g.x, height: g.y2 - g.y, borderRadius: T.radii.node * s * 1.6,
        background: r ? r.fill + '55' : G.fill, border: `${2 * s}px ${G.dashed || g.dashed ? 'dashed' : 'solid'} ${r ? r.border : G.border}`, paddingLeft: 16 * s, paddingTop: 8 * s },
      h('div', sx(th.f('subheading'), { fontSize: 18 * s, letterSpacing: 1.5 * s, color: r ? r.text : G.text, whiteSpace: 'nowrap' }), g.label.toUpperCase()));
  };
  const node = n => {
    const t = D[n.kind === 'header' ? 'normal' : n.kind];
    return h('div', sx(th.f(n.kind === 'header' ? 'nodeStrong' : n.mono ? 'mono' : 'node'), {
        position: 'absolute', left: n.x, top: n.y, height: L.nh, width: n.w, alignItems: 'center', paddingLeft: L.padX, paddingRight: L.padX,
        background: t.fill, border: `${L.bw}px ${t.dashed ? 'dashed' : 'solid'} ${t.border}`, borderRadius: T.radii.node * s, color: t.text,
        fontSize: L.fs, letterSpacing: -0.2, whiteSpace: 'nowrap', boxShadow: D.shadow || undefined }),
      h('div', {}, n.label),
      n.badge && h('div', sx(th.f('nodeStrong'), { position: 'absolute', right: -14 * s, top: -18 * s, background: D.badge.fill, color: D.badge.text, borderRadius: 5 * s,
        border: D.badge.border ? `${1.5 * s}px solid ${D.badge.border}` : undefined, padding: `${3 * s}px ${8 * s}px`, fontSize: 15 * s, letterSpacing: 0.8 }), n.badge));
  };

  return frame(th, spec, W, H, [
    head.length > 0 && h('div', { position: 'absolute', left: pad, top: pad * (sq ? 1.1 : 0.85), flexDirection: 'column' }, ...head),
    ...L.groups.map(groupEl), overlay, ...L.nodes.map(node), ...labels,
    spec.legend && h('div', { position: 'absolute', left: pad, bottom: (spec.caption ? 110 : 80) - 10, flexWrap: 'wrap', maxWidth: W - pad * 2 - 300 }, ...legendRow(th, spec.legend, 1)),
    spec.caption && h('div', sx(th.f('body'), { position: 'absolute', left: pad, bottom: pad - 20, maxWidth: W - pad * 2 - 320, fontSize: 24, color: th.text.small, lineHeight: 1.3 }), spec.caption),
  ], { pad, bylineSize: 24, avatarSize: 52 });
}

export default { name: 'diagram', describe: 'Hand-placed box diagram, ≤5 boxes (dense: true → ≤24 boxes + groups + legend); tree / arrow / curve edges; kinds normal|header|local|conflict|path; optional badge.', validate, render };
