// Benchmark / stat card (Expo changelog look by default): two-line headline, 2–3 bars, a stats row.
// Bar lengths come from `amount` (real measured numbers); `value` is the display string.
import { h } from '../src/h.mjs';
import { theme, sx, T } from '../src/tokens.mjs';
import { fit, textWidth } from '../src/measure.mjs';
import { frame, pill } from '../src/frame.mjs';
import { check, str, num, optPill, optStr } from '../src/validate.mjs';

const validate = spec => check(spec, [
  ['title', v => Array.isArray(v) && v.length >= 1 && v.length <= 2 && v.every(str), 'array of 1–2 lines; line 2 is drawn in the accent colour'],
  ['bars', v => Array.isArray(v) && v.length >= 1 && v.length <= 3, '1–3 bars'],
  ['bars', v => v.every(b => str(b.label) && str(b.value) && num(b.amount) && b.amount >= 0), 'each bar needs label, value (display string) and amount (number from the real measurement)'],
  ['bars', v => v.every(b => !b.tone || ['before', 'after', 'neutral'].includes(b.tone)), 'tone is before | after | neutral'],
  ['stats', v => v === undefined || (Array.isArray(v) && v.length <= 4 && v.every(s => str(s.label) && str(s.value))), 'up to 4 { label, value }'],
  ['stats', v => v === undefined || v.every(s => optStr(s.detail)), 'stat detail must be a string'],
  ['pill', optPill, 'string or { text, logo?, dot? }'], ['task', optStr, 'string'], ['source', optStr, 'string'],
  ['subtitle', optStr, 'string'], ['barsCaption', optStr, 'string'],
  ['sourceSize', v => v === undefined || (num(v) && v >= 14 && v <= 30), 'number 14–30 (px at render size)'],
  ['labelSize', v => v === undefined || (num(v) && v >= 14 && v <= 28), 'number 14–28 (px at render size)'],
]);

function render(spec, { w: W, h: H, pad }, ctx) {
  const th = theme(spec, 'expo'), C = th.chart, sq = H / W > 0.9, P = sq ? 92 : 100;
  const tRole = th.fontRole('display'), maxTW = sq ? W - P * 2 : W - P * 2 - 380;
  const sizes = spec.title.map(l => fit(l, tRole, { max: sq ? 86 : 80, min: 44, maxW: maxTW, maxLines: 1, tracking: -0.045 }));
  const tfs = Math.min(...sizes.map(s => s.size));
  if (sizes.some(s => s.overflow)) ctx.warn('headline line too long; shorten it');
  if (spec.subtitle && textWidth(spec.subtitle, th.fontRole('body'), sq ? 30 : 28) > maxTW) ctx.warn('subtitle too long for one line; shorten it');
  const lbl = sx(th.f('subheading'), { fontSize: spec.labelSize ?? 17, letterSpacing: 3, color: th.text.small });
  const max = Math.max(...spec.bars.map(b => b.amount)) || 1;
  const bar = b => {
    const [c1, c2] = C[b.tone || 'neutral'] || C.neutral, ratio = Math.max(b.amount / max, 0.02);
    const bh = sq ? 78 : 66, trackW = W - P * 2 - (sq ? 170 : 200);
    // Inside only if the measured label (plus padding) fits in the filled part; else it sits after the bar.
    const valueInside = textWidth(b.value, th.fontRole('mono'), sq ? 36 : 32) + 52 <= ratio * trackW;
    return h('div', { alignItems: 'center', marginBottom: sq ? 34 : 26 },
      h('div', sx(lbl, { width: sq ? 170 : 200 }), b.label.toUpperCase()),
      h('div', { flex: 1, height: bh, background: C.track, borderRadius: C.blocky ? 2 : T.radii.bar, border: C.outlined ? undefined : `1px solid ${th.hairline}`, alignItems: 'center' },
        h('div', sx(th.f('mono'), { width: `${(ratio * 100).toFixed(2)}%`, height: '100%', borderRadius: C.blocky ? 2 : T.radii.bar, alignItems: 'center', paddingLeft: 26,
          backgroundImage: C.outlined ? undefined : `linear-gradient(90deg, ${c1}, ${c2})`, border: C.outlined ? `2px solid ${c1}` : undefined, background: C.outlined ? `${c1}22` : undefined,
          boxShadow: C.glow ? `0 0 48px ${c1}55` : undefined, fontSize: sq ? 36 : 32, color: C.outlined ? th.text.strong : '#0b0b0b', whiteSpace: 'nowrap' }), valueInside ? b.value : ''),
        !valueInside && h('div', sx(th.f('mono'), { marginLeft: 20, fontSize: sq ? 34 : 30, color: th.text.strong, whiteSpace: 'nowrap' }), b.value)));
  };
  const stat = st => h('div', { flexDirection: 'column', flex: 1 },
    h('div', sx(lbl, { fontSize: spec.labelSize ? spec.labelSize - 1 : 16, marginBottom: 10 }), st.label.toUpperCase()),
    h('div', { alignItems: 'baseline' },
      h('div', sx(th.f('number'), { fontSize: sq ? 60 : 56, letterSpacing: -1.5, color: th.text.accent, whiteSpace: 'nowrap' }), st.value),
      st.detail && h('div', sx(th.f('mono'), { fontSize: sq ? 32 : 30, marginLeft: 18, color: th.text.strong, whiteSpace: 'nowrap' }), st.detail)));
  const taskBlock = spec.task && h('div', { flexDirection: 'column', alignItems: sq ? 'flex-end' : 'flex-end' },
    h('div', sx(lbl, { fontSize: 16, marginTop: sq ? 0 : 28 }), (spec.taskLabel || 'TASK').toUpperCase()),
    h('div', sx(th.f('mono'), { fontSize: 20, color: th.text.body, marginTop: 8 }), spec.task));
  const pillEl = spec.pill && pill(th, typeof spec.pill === 'string' ? { text: spec.pill, dot: true } : spec.pill, { scale: 0.92 });

  return frame(th, spec, W, H, [
    h('div', { position: 'absolute', left: 0, top: 0, width: W, height: H, flexDirection: 'column', justifyContent: 'space-between', padding: P },
      h('div', { justifyContent: 'space-between', alignItems: 'flex-start' },
        h('div', { flexDirection: 'column' }, ...spec.title.map((l, i) => h('div', sx(th.f('display'), { fontSize: tfs, letterSpacing: -tfs * 0.045, lineHeight: 1.0, color: i ? th.text.accent : th.text.title, whiteSpace: 'nowrap' }), l)),
          spec.subtitle && h('div', sx(th.f('body'), { fontSize: sq ? 30 : 28, color: th.text.body, marginTop: 18, whiteSpace: 'nowrap' }), spec.subtitle)),
        !sq && h('div', { flexDirection: 'column', alignItems: 'flex-end' }, pillEl, taskBlock)),
      sq && (pillEl || taskBlock) && h('div', { alignItems: 'center', justifyContent: 'space-between' }, pillEl || h('div', {}), taskBlock),
      h('div', { flexDirection: 'column' },
        spec.barsCaption && h('div', sx(lbl, { marginBottom: 18, color: th.text.body }), spec.barsCaption.toUpperCase()),
        ...spec.bars.map(bar)),
      h('div', { flexDirection: 'column' },
        spec.stats?.length > 0 && h('div', { borderTop: `1px solid ${th.hairline}`, paddingTop: 30 }, ...spec.stats.map(stat)),
        spec.source && h('div', sx(th.f('body'), { fontSize: spec.sourceSize ?? 18, lineHeight: 1.35, color: th.text.faint, marginTop: 18 }), spec.source))),
  ], { footer: false });
}
export default { name: 'stat', describe: 'Benchmark / stat card: headline (2 lines), 1–3 bars scaled from real amounts, up to 4 stats.', validate, render };
