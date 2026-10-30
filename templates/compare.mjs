// Before/after comparison chart: up to 4 metrics, each with a before and an after bar.
// Deltas are computed from the numbers — never typed in by hand.
import { h } from '../src/h.mjs';
import { theme, sx, T } from '../src/tokens.mjs';
import { fit, textWidth } from '../src/measure.mjs';
import { frame, pill } from '../src/frame.mjs';
import { check, str, num, optPill, optStr } from '../src/validate.mjs';

const validate = spec => check(spec, [
  ['title', v => Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every(str), 'array of 1–2 lines'],
  ['rows', v => Array.isArray(v) && v.length >= 1 && v.length <= 12, '1–12 rows (5+ switches to the compact one-line-per-metric layout)'],
  ['rows', v => v.every(r => str(r.label) && num(r.before) && num(r.after) && r.before > 0 && r.after >= 0), 'each row needs label, before > 0, after ≥ 0 (real measured numbers)'],
  ['legend', v => v === undefined || (str(v.before) && str(v.after)), '{ before, after } strings'],
  ['delta', v => v === undefined || ['factor', 'percent'].includes(v), 'factor | percent'],
  ['pill', optPill, 'string or { text, logo?, dot? }'], ['unit', optStr, 'string'], ['source', optStr, 'string'],
]);
const MINUS = '\u2212';
const fmt = (v, d) => v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });

function render(spec, { w: W, h: H }, ctx) {
  const th = theme(spec, 'expo'), C = th.chart, sq = H / W > 0.9, P = sq ? 88 : 96;
  const lower = spec.lowerIsBetter !== false, mode = spec.delta || 'factor';
  const lbl = sx(th.f('subheading'), { fontSize: 17, letterSpacing: 3, color: th.text.small });
  const tRole = th.fontRole('display');
  const sizes = spec.title.map(l => fit(l, tRole, { max: sq ? 78 : 70, min: 40, maxW: sq ? W - P * 2 : W - P * 2 - 420, maxLines: 1, tracking: -0.04 }));
  const tfs = Math.min(...sizes.map(s => s.size));
  if (sizes.some(s => s.overflow)) ctx.warn('headline line too long; shorten it');

  const rows = spec.rows.map(r => {
    const unit = r.unit ?? spec.unit ?? '', d = r.decimals ?? spec.decimals ?? 0;
    const better = lower ? r.after < r.before : r.after > r.before;
    const factor = lower ? r.before / r.after : r.after / r.before;
    const pct = (r.after - r.before) / r.before * 100;
    const delta = mode === 'factor' && Number.isFinite(factor) ? `${fmt(factor, factor >= 10 ? 0 : 1)}×` : `${pct < 0 ? MINUS : '+'}${fmt(Math.abs(pct), Math.abs(pct) < 10 ? 1 : 0)}%`;
    if (!better) ctx.warn(`row "${r.label}": after is worse than before — check lowerIsBetter`);
    return { ...r, unit, d, better, delta, deltaLabel: r.deltaLabel ?? spec.deltaLabel ?? (lower ? (mode === 'factor' ? 'faster' : 'less') : (mode === 'factor' ? 'more' : 'more')) };
  });
  const n = rows.length, avail = H - P * 2 - (tfs * spec.title.length) - (sq ? 220 : 120) - (spec.source ? 40 : 0);
  const bh = Math.min(sq ? 54 : 40, (avail / n - 34) / 2.25), gap = Math.max(8, bh * 0.25);
  const labelW = sq ? 0 : 300, deltaW = sq ? 230 : 250;
  const valueW = Math.max(...rows.flatMap(r => [r.before, r.after].map(v => textWidth(`${fmt(v, r.d)}${r.unit ? ' ' + r.unit : ''}`, th.fontRole('mono'), bh * 0.62)))) + 20;

  const barEl = (v, max, tone, text) => {
    const [c1, c2] = C[tone], ratio = Math.max(v / max, 0.015);
    return h('div', { alignItems: 'center', height: bh, marginBottom: gap },
      h('div', { width: `${(ratio * 100).toFixed(2)}%`, maxWidth: '100%', height: bh, borderRadius: C.blocky ? 2 : Math.min(T.radii.bar, bh / 2),
        backgroundImage: C.outlined ? undefined : `linear-gradient(90deg, ${c1}, ${c2})`, border: C.outlined ? `2px solid ${c1}` : undefined, background: C.outlined ? `${c1}22` : undefined,
        boxShadow: C.glow ? `0 0 36px ${c1}44` : undefined }),
      h('div', sx(th.f('mono'), { marginLeft: 16, fontSize: bh * 0.62, color: th.text.strong, whiteSpace: 'nowrap', minWidth: valueW }), text));
  };
  // Compact layout for 5–12 metrics: one line per metric, ghost "before" bar behind the solid "after" bar.
  const compact = n > 4 || spec.compact === true;
  const rowH = (H - P * 2 - tfs * spec.title.length - (sq ? 200 : 110) - (spec.source ? 40 : 0)) / n;
  const cLab = Math.max(17, Math.min(28, rowH * 0.36)), cVal = Math.max(16, Math.min(24, rowH * 0.3)), cDel = Math.max(22, Math.min(46, rowH * 0.5)), cBar = Math.max(10, Math.min(30, rowH * 0.34));
  const cLabW = sq ? Math.min(W * 0.3, Math.max(...rows.map(r => textWidth(r.label, th.fontRole('heading'), cLab))) + 24) : Math.max(...rows.map(r => textWidth(r.label, th.fontRole('heading'), cLab))) + 28;
  const cValW = Math.max(...rows.map(r => textWidth(`${fmt(r.before, r.d)} \u2192 ${fmt(r.after, r.d)}${r.unit ? ' ' + r.unit : ''}`, th.fontRole('mono'), cVal))) + 24;
  const cDelW = Math.max(...rows.map(r => textWidth(r.delta, th.fontRole('number'), cDel))) + 10;
  if (compact) {
    if (cLab * 1600 / W < T.legibility.minPx || cVal * 1600 / W < T.legibility.minPx) ctx.warn(`${n} rows leave text below ${T.legibility.minPx}px; split into two images or use 1080x1350`);
    if (rowH < 44) ctx.warn(`${n} rows at ${Math.round(rowH)}px each are too cramped; split into two images or use a taller size`);
  }
  const compactRow = r => {
    const max = Math.max(r.before, r.after), [b1] = C.before, [a1, a2] = C[r.better ? 'after' : 'before'];
    return h('div', { alignItems: 'center', height: rowH, borderTop: `1px solid ${th.hairline}` },
      h('div', sx(th.f('heading'), { width: cLabW, fontSize: cLab, color: th.text.title, paddingRight: 16, whiteSpace: 'nowrap' }), r.label),
      h('div', { flex: 1, height: cBar, position: 'relative', alignItems: 'center' },
        h('div', { position: 'absolute', left: 0, top: 0, height: cBar, width: `${(r.before / max * 100).toFixed(2)}%`, borderRadius: C.blocky ? 2 : cBar / 2, background: `${b1}33`, border: `1.5px solid ${b1}88` }),
        h('div', { position: 'absolute', left: 0, top: cBar * 0.2, height: cBar * 0.6, width: `${(Math.max(r.after / max, 0.01) * 100).toFixed(2)}%`, borderRadius: C.blocky ? 2 : cBar / 2, backgroundImage: `linear-gradient(90deg, ${a1}, ${a2})` })),
      h('div', sx(th.f('mono'), { width: cValW, justifyContent: 'flex-end', fontSize: cVal, color: th.text.body, whiteSpace: 'nowrap' }), `${fmt(r.before, r.d)} \u2192 ${fmt(r.after, r.d)}${r.unit ? ' ' + r.unit : ''}`),
      h('div', sx(th.f('number'), { width: cDelW + 20, justifyContent: 'flex-end', fontSize: cDel, letterSpacing: -1, color: r.better ? th.chart.afterText : th.chart.beforeText }), r.delta));
  };
  const row = r => {
    const max = Math.max(r.before, r.after);
    const label = h('div', sx(th.f('heading'), { fontSize: sq ? 30 : 28, color: th.text.title, marginBottom: sq ? 14 : 0, width: sq ? undefined : labelW, paddingRight: 24, lineHeight: 1.15 }), r.label);
    return h('div', { flexDirection: 'column', paddingTop: sq ? 22 : 18, paddingBottom: sq ? 12 : 8, borderTop: `1px solid ${th.hairline}` },
      sq && label,
      h('div', { alignItems: 'center' },
        !sq && label,
        h('div', { flex: 1, flexDirection: 'column', paddingRight: valueW + 16 },
          barEl(r.before, max, 'before', `${fmt(r.before, r.d)}${r.unit ? ' ' + r.unit : ''}`),
          barEl(r.after, max, r.better ? 'after' : 'before', `${fmt(r.after, r.d)}${r.unit ? ' ' + r.unit : ''}`)),
        h('div', { width: deltaW, flexDirection: 'column', alignItems: 'flex-end' },
          h('div', sx(th.f('number'), { fontSize: sq ? 64 : 56, letterSpacing: -1.5, color: r.better ? th.chart.afterText : th.chart.beforeText, lineHeight: 1 }), r.delta),
          h('div', sx(lbl, { fontSize: 16, marginTop: 8 }), r.deltaLabel.toUpperCase()))));
  };
  const legend = spec.legend && h('div', { alignItems: 'center', marginTop: sq ? 0 : 26 },
    ...[['before', spec.legend.before], ['after', spec.legend.after]].map(([tone, t]) => h('div', { alignItems: 'center', marginLeft: 22 },
      h('div', { width: 14, height: 14, borderRadius: 4, backgroundImage: `linear-gradient(90deg, ${C[tone][0]}, ${C[tone][1]})`, marginRight: 10 }),
      h('div', sx(lbl, { fontSize: 16 }), t.toUpperCase()))));
  const pillEl = spec.pill && pill(th, typeof spec.pill === 'string' ? { text: spec.pill, dot: true } : spec.pill, { scale: 0.92 });

  return frame(th, spec, W, H, [
    h('div', { position: 'absolute', left: 0, top: 0, width: W, height: H, flexDirection: 'column', padding: P },
      h('div', { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: sq ? 40 : 34 },
        h('div', { flexDirection: 'column' }, ...spec.title.map((l, i) => h('div', sx(th.f('display'), { fontSize: tfs, letterSpacing: -tfs * 0.04, lineHeight: 1.02, color: i ? th.text.accent : th.text.title, whiteSpace: 'nowrap' }), l))),
        !sq && h('div', { flexDirection: 'column', alignItems: 'flex-end' }, pillEl, legend)),
      sq && h('div', { justifyContent: 'space-between', alignItems: 'center', marginBottom: 34 }, pillEl || h('div', {}), legend),
      h('div', { flexDirection: 'column', flex: 1, justifyContent: 'center' }, ...rows.map(compact ? compactRow : row)),
      spec.source && h('div', sx(th.f('body'), { fontSize: 18, color: th.text.faint, marginTop: 14 }), spec.source)),
  ], { footer: false });
}
export default { name: 'compare', describe: 'Before/after comparison: 1–4 metrics as big bars, or 5–12 in a compact one-line-per-metric layout; computed × or % deltas.', validate, render };
