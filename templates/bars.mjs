// Grouped bar chart in the kit's benchmark-card look (the `stat` / `compare` bars): horizontal rows, a dark rounded
// track per bar, a gradient fill that glows in glowing styles, the mono value inside the fill (or just after it when
// the fill is too short), uppercase tracked category labels on the left. 1–6 series × 1–24 categories. Real numbers only.
import { h } from '../src/h.mjs';
import { theme, sx, T } from '../src/tokens.mjs';
import { textWidth } from '../src/measure.mjs';
import { card } from '../src/card.mjs';
import { fmtNum, seriesColor, clamp, legible } from '../src/chart.mjs';
import { check, str, num, optStr } from '../src/validate.mjs';

const TONES = ['before', 'after', 'neutral', 'mint'];
const validate = spec => check(spec, [
  ['categories', v => Array.isArray(v) && v.length >= 1 && v.length <= 24 && v.every(str), '1–24 category labels'],
  ['series', v => Array.isArray(v) && v.length >= 1 && v.length <= 6, '1–6 series'],
  ['series', (v, s) => v.every(x => str(x.name) && Array.isArray(x.values) && x.values.length === s.categories.length && x.values.every(n => n === null || (num(n) && n >= 0))), 'each series needs name and one value (number ≥ 0, or null) per category; use line or table for negative values'],
  ['series', v => v.every(x => !x.tone || TONES.includes(x.tone)), `series tone is ${TONES.join(' | ')}`],
  ['series', (v, s) => v.length * s.categories.length <= 72, 'at most 72 bars in one image — split into a thread'],
  ['tones', (v, s) => v === undefined || (Array.isArray(v) && v.length === s.series.length && v.every(t => t === null || TONES.includes(t))), `one tone per series (${TONES.join(' | ')} | null)`],
  ['unit', optStr, 'string'], ['title', optStr, 'string'], ['subtitle', optStr, 'string'], ['source', optStr, 'string'],
  ['highlight', (v, s) => v === undefined || s.categories.includes(v), 'must be one of the categories'],
  ['orientation', v => v === undefined || v === 'horizontal', 'bars are always horizontal track bars now (vertical columns were retired); drop the field, or use line for time series'],
  ['sort', v => v === undefined || ['desc', 'asc'].includes(v), 'desc | asc (by the first series)'],
  ['max', v => v === undefined || (num(v) && v > 0), 'positive number: full-track value (to share a scale across images)'],
  ['seriesLabels', v => v === undefined || ['inline', 'legend'].includes(v), 'inline | legend'],
  ['labelCase', v => v === undefined || ['upper', 'as-is'].includes(v), 'upper | as-is'],
]);

const rgb = c => { const m = /^#([0-9a-f]{6})$/i.exec(c || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return x && y ? '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('') : a; };

// Fill gradient per series: an explicit tone uses the style's own benchmark pair (exactly what stat/compare use);
// otherwise the series colour, light → deep, the same direction as the Expo changelog bars. Flat in blocky/outlined styles.
function fills(th, spec) {
  const C = th.chart;
  return spec.series.map((s, i) => {
    const tone = s.tone || spec.tones?.[i];
    if (tone && Array.isArray(C[tone])) return C[tone];
    const col = seriesColor(th, i, s);
    return C.blocky || C.outlined ? [col, col] : [mix(col, '#ffffff', 0.1), mix(col, '#000000', 0.3)];
  });
}

function render(spec, z, ctx) {
  const th = theme(spec, 'expo'), C = th.chart, W = z.w, d = spec.decimals ?? 0, unit = spec.unit ?? '';
  let cats = spec.categories.map((c, i) => ({ c, i }));
  if (spec.sort) cats.sort((a, b) => ((spec.series[0].values[b.i] ?? -1) - (spec.series[0].values[a.i] ?? -1)) * (spec.sort === 'desc' ? 1 : -1));
  const S = spec.series, m = S.length, n = cats.length, F = fills(th, spec);
  const mono = th.fontRole('mono'), all = S.flatMap(s => s.values).filter(v => v !== null);
  const max = spec.max ?? (Math.max(...all) || 1);
  if (spec.max && Math.max(...all) > spec.max) ctx.warn(`a value exceeds max (${spec.max}); its bar is clipped at the full track`);

  // Pass 1 (no legend) decides whether series names fit inline; the legend only appears when they don't.
  const probe = card(th, spec, z, { warn() {}, note() {} }, {});
  const gh0 = probe.box.h / n, inline0 = m > 1 && spec.seriesLabels !== 'legend' && (gh0 * 0.8) / m >= 42 * probe.k;
  const inline = spec.seriesLabels === 'inline' ? m > 1 : inline0;
  const legend = m > 1 && !inline ? S.map((s, i) => ({ label: s.name, color: F[i][0] })) : undefined;
  const { box, wrap, k } = card(th, spec, z, ctx, { legend });

  // Geometry: the stat card is 66px bars with a 26px gap at 1600 wide; dense charts shrink towards ~10px tracks.
  const gh0b = box.h / n, gapIn = m > 1 ? clamp(gh0b * 0.06, 4 * k, 10 * k) : 0;
  const fill = m > 1 ? (gh0b < 90 * k ? 0.86 : 0.8) : (gh0b < 60 * k ? 0.74 : 0.68);
  const bh = Math.min(m > 1 ? 50 * k : 66 * k, (gh0b * fill - gapIn * (m - 1)) / m), thin = bh < 26 * k;
  // Once bars hit their cap, stop spreading rows apart: keep the stat-card rhythm and centre the block.
  const inner0 = bh * m + gapIn * (m - 1), gh = Math.min(gh0b, inner0 + clamp(inner0 * 0.6, 26 * k, 64 * k)), top0 = box.y + (box.h - gh * n) / 2;
  const inner = bh * m + gapIn * (m - 1), radius = C.blocky ? 2 : Math.min(T.radii.bar * k, bh / 2);
  if (bh < 8) ctx.warn(`bars are only ${bh.toFixed(1)}px tall; use fewer categories/series, a taller size (1080x1350) or split into a thread`);

  const upper = spec.labelCase !== 'as-is' && cats.every(({ c }) => c.length <= 20);
  const labRole = th.fontRole(upper ? 'subheading' : 'heading');
  const labFs = clamp((m > 1 ? inner * 0.32 : bh * 0.34), 16 * k, (upper ? 20 : 26) * k), ls = upper ? labFs * 0.17 : 0;
  const lab = c => upper ? c.toUpperCase() : c;
  const labW0 = Math.max(...cats.map(({ c }) => textWidth(lab(c), labRole, labFs) + ls * c.length));
  const labW = Math.min(box.w * 0.32, Math.max(upper ? 150 * k : 120 * k, labW0 + 40 * k));
  if (labW0 + 40 * k > labW) ctx.warn('a category label is clipped; shorten it');
  
  // Values: inside the fill (dark on the gradient) when they fit, else right after the fill on the track.
  const vIn = clamp(bh * 0.48, 15 * k, 32 * k), vOut = clamp(bh + gapIn * 0.8, 14 * k, 22 * k), padV = clamp(bh * 0.38, 10 * k, 26 * k);
  const sLab = clamp(bh * 0.36, 15 * k, 19 * k);
  // Thin (dense) bars put every value after its fill, so reserve room for the widest one.
  const reserve = thin ? Math.max(...all.map(v => textWidth(fmtNum(v, d, unit), mono, vOut))) + 22 * k : 0;
  const tx = box.x + labW, tw = box.w - labW - reserve;
  legible(ctx, labFs, W, 'category labels');
  const els = []; let tightOut = 0;

  cats.forEach(({ c, i: ci }, row) => {
    const gy = top0 + row * gh, y0 = gy + (gh - inner) / 2, hi = !spec.highlight || c === spec.highlight;
    if (m > 1 && row > 0) els.push(h('div', { position: 'absolute', left: box.x, top: gy, width: box.w, height: 0, borderTop: `1px solid ${th.hairline}` }));
    els.push(h('div', sx(th.f(upper ? 'subheading' : 'heading'), { position: 'absolute', left: box.x, top: gy + gh / 2 - labFs * 0.62, width: labW - 24 * k, fontSize: labFs, letterSpacing: ls,
      color: spec.highlight && c === spec.highlight ? th.text.accent : upper ? th.text.small : th.text.strong, whiteSpace: 'nowrap', overflow: 'hidden' }), lab(c)));
    S.forEach((s, si) => {
      const v = s.values[ci], y = y0 + si * (bh + gapIn), [c1, c2] = F[si];
      const ratio = v === null ? 0 : v === 0 ? 0 : Math.min(1, Math.max(v / max, 0.012)), fw = ratio * tw;
      const txt = v === null ? '—' : fmtNum(v, d, unit), inW = textWidth(txt, mono, vIn) + padV * 2, fitsIn = v !== null && !thin && inW <= fw;
      const glow = (C.glow || (spec.highlight && c === spec.highlight && !C.outlined)) && hi && v ? `0 0 ${Math.round(clamp(bh * 0.75, 12, 48 * k))}px ${c1}${bh > 30 ? '55' : '40'}` : undefined;
      els.push(h('div', { position: 'absolute', left: tx, top: y, width: tw, height: bh, background: C.track, borderRadius: radius,
        border: C.outlined ? `1px solid ${th.hairline}` : `1px solid ${th.hairline}`, opacity: hi ? 1 : 0.7 }));
      if (fw > 0) els.push(h('div', sx(th.f('mono'), { position: 'absolute', left: tx, top: y, width: Math.max(fw, radius * 2), height: bh, borderRadius: radius, alignItems: 'center', paddingLeft: padV,
        backgroundImage: C.outlined ? undefined : `linear-gradient(90deg, ${c1}, ${c2})`, background: C.outlined ? `${c1}22` : undefined, border: C.outlined ? `2px solid ${c1}` : undefined,
        boxShadow: glow, opacity: hi ? 1 : 0.78, fontSize: vIn, color: C.outlined ? th.text.strong : '#0b0b0b', whiteSpace: 'nowrap' }), fitsIn ? txt : ''));
      if (!fitsIn) {
        const fs = thin ? vOut : vIn;
        if (fs > bh + gapIn + 2) tightOut++;
        els.push(h('div', sx(th.f('mono'), { position: 'absolute', left: tx + Math.max(fw, 0) + 14 * k, top: y + bh / 2 - fs * 0.62, fontSize: fs, color: v === null ? th.text.faint : hi ? th.text.strong : th.text.body, opacity: hi ? 1 : 0.8, whiteSpace: 'nowrap' }), txt));
      }
      if (inline) {
        const nw = textWidth(s.name, th.fontRole('label'), sLab), under = fw > tw - nw - 20 * k;
        els.push(h('div', sx(th.f('label'), { position: 'absolute', left: tx + tw - nw - 18 * k, top: y + bh / 2 - sLab * 0.62, fontSize: sLab, whiteSpace: 'nowrap',
          color: under && !C.outlined ? 'rgba(11,11,11,0.62)' : th.text.small, opacity: hi ? 1 : 0.7 }), s.name));
      }
    });
  });
  legible(ctx, Math.min(vIn, vOut), W, 'value labels');
  if (inline) legible(ctx, sLab, W, 'series labels');
  if (tightOut) ctx.note(`${tightOut} value label(s) are taller than their bar slot; use fewer categories/series or a taller size`);
  return wrap(els);
}
export default { name: 'bars', describe: 'Grouped bars in the benchmark-card look: horizontal gradient bars on dark tracks, values inside the fill, uppercase labels; 1–6 series × up to 24 categories, inline series names or legend, tones, highlight, sort.', validate, render };
