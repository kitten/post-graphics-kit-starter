// Shared helpers for data templates (bars, line, table): nice axis ticks, number formatting, series colours,
// and an engine-independent legibility check (the HTML engine also measures the real DOM).
import { T } from './tokens.mjs';

export function niceTicks(lo, hi, count = 5) {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step, out = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(+v.toFixed(10));
  return { ticks: out, min: start, max: end, step };
}
export const fmtNum = (v, d = 0, unit = '') => {
  const s = Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + 'M'
    : Math.abs(v) >= 1e4 && d === 0 ? (v / 1e3).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + 'k'
    : v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  return (v < 0 ? s.replace('-', '\u2212') : s) + (unit ? (['%', '×', 'x', 'k', 'M', 'B'].includes(unit) ? '' : ' ') + unit : '');
};
export const seriesColor = (th, i, s) => s?.color || th.chart.series[i % th.chart.series.length];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { clamp };

// Pre-render check on the font sizes a template chose (normalised to the 1600px-wide reference).
export function legible(ctx, fs, W, what) {
  const eff = fs * T.legibility.refWidth / W;
  if (eff < T.legibility.minPx) ctx.warn(`${what}: ${eff.toFixed(1)}px effective — illegible on a phone. Use fewer rows/series, a taller size (1080x1350) or split into a thread of images`);
  else if (eff < T.legibility.warnPx) ctx.note?.(`${what}: ${eff.toFixed(1)}px effective — small on a phone`);
  return eff;
}
