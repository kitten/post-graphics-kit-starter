// Time-series / line chart: 1–6 series over shared x labels, nice y axis, labels at line ends, annotations.
import { h, img } from '../src/h.mjs';
import { theme, sx } from '../src/tokens.mjs';
import { textWidth } from '../src/measure.mjs';
import { svgURI } from '../src/frame.mjs';
import { card } from '../src/card.mjs';
import { niceTicks, fmtNum, seriesColor, clamp, legible } from '../src/chart.mjs';
import { check, str, num, optStr } from '../src/validate.mjs';

const validate = spec => check(spec, [
  ['x', v => Array.isArray(v) && v.length >= 2 && v.length <= 400 && v.every(x => str(String(x))), '2–400 x labels (dates, versions, …)'],
  ['series', v => Array.isArray(v) && v.length >= 1 && v.length <= 6, '1–6 series'],
  ['series', (v, s) => v.every(x => str(x.name) && Array.isArray(x.values) && x.values.length === s.x.length && x.values.every(n => n === null || num(n))), 'each series needs name and one value (number or null) per x'],
  ['annotations', (v, s) => v === undefined || v.every(a => str(a.label) && (s.x.map(String).includes(String(a.x)))), '[{ x (one of x), label }]'],
  ['unit', optStr, 'string'], ['title', optStr, 'string'], ['subtitle', optStr, 'string'], ['source', optStr, 'string'],
]);

function render(spec, z, ctx) {
  const th = theme(spec, 'devlog'), W = z.w, S = spec.series, X = spec.x.map(String), d = spec.decimals ?? 0, unit = spec.unit ?? '';
  const legend = spec.legend === true ? S.map((s, i) => ({ label: s.name, color: seriesColor(th, i, s), line: true, dashed: s.dashed })) : undefined;
  const { box, wrap, k } = card(th, spec, z, ctx, { legend });
  const all = S.flatMap(s => s.values).filter(v => v !== null);
  const { ticks, min, max } = niceTicks(spec.yMin ?? (spec.zero === false ? Math.min(...all) : Math.min(0, ...all)), spec.yMax ?? Math.max(...all), spec.ticks ?? 5);
  const mono = th.fontRole('mono'), tickFs = 17 * k, endFs = 19 * k;
  const yW = Math.max(...ticks.map(t => textWidth(fmtNum(t, d, unit), mono, tickFs))) + 14;
  const endLabels = spec.endLabels !== false && !legend;
  const endW = endLabels ? Math.max(...S.map((s, i) => textWidth(s.name, th.fontRole('label'), endFs) + textWidth(' ' + fmtNum(last(s.values) ?? 0, d, unit), mono, endFs))) + 24 : 16 * k;
  const annH = spec.annotations?.length ? 34 * k : 8;
  const px = box.x + yW, pw = box.w - yW - endW, py = box.y + annH, ph = box.h - annH - tickFs * 1.6 - 10;
  const xp = i => px + (X.length === 1 ? pw / 2 : i / (X.length - 1) * pw), yp = v => py + ph - (v - min) / (max - min) * ph;
  legible(ctx, tickFs, W, 'axis labels');

  let svg = '';
  const els = [];
  for (const t of ticks) {
    svg += `<path d="M${px} ${yp(t)}H${px + pw}" stroke="${t === 0 && min < 0 ? th.text.small : th.hairline}" stroke-width="1" ${t ? 'stroke-dasharray="4 6"' : ''}/>`;
    els.push(h('div', sx(th.f('mono'), { position: 'absolute', left: box.x, top: yp(t) - tickFs * 0.65, width: yW - 12, justifyContent: 'flex-end', fontSize: tickFs, color: th.text.small }), fmtNum(t, d, unit)));
  }
  svg += `<path d="M${px} ${py + ph}H${px + pw}" stroke="${th.text.small}" stroke-width="1.5"/>`;
  // x ticks: thin so labels never collide
  const xw = Math.max(...X.map(x => textWidth(x, mono, tickFs))) + 18 * k, every = Math.max(1, Math.ceil(xw / (pw / Math.max(1, X.length - 1))));
  X.forEach((x, i) => {
    if (i % every && i !== X.length - 1) return;
    if (i === X.length - 1 && i % every && (i % every) < every * 0.6) return;
    const tw = textWidth(x, mono, tickFs);
    els.push(h('div', sx(th.f('mono'), { position: 'absolute', left: clamp(xp(i) - tw / 2, px - yW / 2, px + pw - tw + endW / 2), top: py + ph + 10, fontSize: tickFs, color: th.text.small, whiteSpace: 'nowrap' }), x));
  });
  for (const a of spec.annotations || []) {
    const i = X.indexOf(String(a.x)), x = xp(i), fs = 17 * k, tw = textWidth(a.label, th.fontRole('label'), fs);
    svg += `<path d="M${x} ${py - 4}V${py + ph}" stroke="${th.text.accent}" stroke-width="2" stroke-dasharray="6 6" opacity=".8"/>`;
    els.push(h('div', sx(th.f('label'), { position: 'absolute', left: clamp(x - tw / 2, box.x, px + pw + endW - tw), top: py - annH + 2, fontSize: fs, color: th.text.accent, whiteSpace: 'nowrap' }), a.label));
  }
  const ends = [];
  S.forEach((s, si) => {
    const col = seriesColor(th, si, s), sw = (s.width ?? (S.length > 3 ? 3.5 : 4.5)) * k;
    let dpath = '', pen = false;
    s.values.forEach((v, i) => { if (v === null) { pen = false; return; } dpath += `${pen ? 'L' : 'M'}${xp(i).toFixed(1)} ${yp(v).toFixed(1)}`; pen = true; });
    if (spec.area && S.length === 1) svg += `<path d="${dpath}L${xp(X.length - 1)} ${yp(Math.max(min, 0))}L${xp(0)} ${yp(Math.max(min, 0))}Z" fill="${col}" opacity=".14"/>`;
    svg += `<path d="${dpath}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? `stroke-dasharray="${sw * 2.4} ${sw * 2}"` : ''}/>`;
    if (spec.dots || X.length <= 16) s.values.forEach((v, i) => { if (v !== null) svg += `<circle cx="${xp(i)}" cy="${yp(v)}" r="${sw * 1.05}" fill="${th.bg}" stroke="${col}" stroke-width="${sw * 0.75}"/>`; });
    const li = lastIdx(s.values);
    if (li >= 0) { svg += `<circle cx="${xp(li)}" cy="${yp(s.values[li])}" r="${sw * 1.5}" fill="${col}"/>`; ends.push({ y: yp(s.values[li]), x: xp(li), s, col, v: s.values[li] }); }
  });
  if (endLabels) {
    ends.sort((a, b) => a.y - b.y);
    const gap = endFs * 1.25;
    for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].y, (ends[i - 1].ly ?? ends[i - 1].y) + gap);
    ends[0].ly = ends[0].y;
    const over = (ends.at(-1).ly) - (py + ph); if (over > 0) ends.forEach(e => e.ly -= over);
    for (const e of ends) els.push(h('div', { position: 'absolute', left: px + pw + 14 * k, top: e.ly - endFs * 0.65, alignItems: 'baseline', whiteSpace: 'nowrap' },
      h('div', sx(th.f('label'), { fontSize: endFs, color: e.col }), e.s.name),
      h('div', sx(th.f('mono'), { fontSize: endFs, color: th.text.body, marginLeft: 8 }), fmtNum(e.v, d, unit))));
  }
  return wrap([img(svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${z.w}" height="${z.h}" viewBox="0 0 ${z.w} ${z.h}">${svg}</svg>`), { position: 'absolute', left: 0, top: 0, width: z.w, height: z.h }), ...els]);
}
const lastIdx = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] !== null) return i; return -1; };
const last = a => { const i = lastIdx(a); return i < 0 ? null : a[i]; };
export default { name: 'line', describe: 'Time-series line chart: 1–6 series, nice y axis, thinned x ticks, end labels (or legend), dashed series, annotations.', validate, render };
