// Dense table / benchmark matrix: header row, auto font sizing, best-in-column highlight, highlighted rows/cells.
import { h } from '../src/h.mjs';
import { theme, sx } from '../src/tokens.mjs';
import { textWidth } from '../src/measure.mjs';
import { card } from '../src/card.mjs';
import { fmtNum, clamp, legible } from '../src/chart.mjs';
import { check, str, num, optStr } from '../src/validate.mjs';

const TONES = ['good', 'bad', 'accent', 'muted'];
const validate = spec => check(spec, [
  ['columns', v => Array.isArray(v) && v.length >= 2 && v.length <= 10 && v.every(c => str(typeof c === 'string' ? c : c.label)), '2–10 columns (string or { label, align?, unit?, decimals?, best?: "min"|"max", mono? })'],
  ['columns', v => v.every(c => typeof c === 'string' || !c.best || ['min', 'max'].includes(c.best)), 'best is "min" or "max"'],
  ['rows', (v, s) => Array.isArray(v) && v.length >= 1 && v.length <= 30 && v.every(r => (Array.isArray(r) ? r : r.cells).length === s.columns.length), '1–30 rows; each row is an array (or { cells, highlight? }) with one cell per column'],
  ['cells', (v, s) => v === undefined || v.every(c => num(c.row) && num(c.col) && TONES.includes(c.tone || 'accent')), `[{ row, col, tone: ${TONES.join('|')} }] (0-based, body rows)`],
  ['title', optStr, 'string'], ['subtitle', optStr, 'string'], ['source', optStr, 'string'],
]);

function render(spec, z, ctx) {
  const th = theme(spec, 'blueprint'), W = z.w;
  const cols = spec.columns.map((c, i) => typeof c === 'string' ? { label: c } : c).map((c, i) => ({ ...c, align: c.align ?? (i === 0 ? 'left' : 'right') }));
  const rows = spec.rows.map(r => Array.isArray(r) ? { cells: r } : r);
  const tone = { good: th.diagram.local.text, bad: th.diagram.conflict.text, accent: th.text.accent, muted: th.text.small };
  const cellText = (v, c) => v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? fmtNum(v, c.decimals ?? 0, c.unit ?? '') : String(v);
  const best = cols.map((c, ci) => {
    if (!c.best) return null;
    const vals = rows.map(r => r.cells[ci]).filter(num); if (!vals.length) return null;
    return c.best === 'min' ? Math.min(...vals) : Math.max(...vals);
  });
  const hl = new Map((spec.cells || []).map(c => [`${c.row}:${c.col}`, c.tone || 'accent']));
  const { box, wrap, k } = card(th, spec, z, ctx, { legend: spec.legend });
  const n = rows.length + 1, rowH = Math.min(70 * k, box.h / n);
  const roleOf = (c, ci) => c.mono ?? ci > 0 ? th.fontRole('mono') : th.fontRole('label');
  const natural = fs => cols.map((c, ci) => Math.max(textWidth(c.label.toUpperCase(), th.fontRole('subheading'), fs * 0.72) * 1.12, ...rows.map(r => textWidth(cellText(r.cells[ci], c), roleOf(c, ci), fs))) + fs * 1.6);
  let fs = clamp(rowH * 0.44, 12, 28 * k);
  while (fs > 11 && natural(fs).reduce((a, b) => a + b, 0) > box.w) fs -= 0.5;
  legible(ctx, fs, W, 'table cells');
  legible(ctx, fs * 0.72, W, 'table header');
  const nat = natural(fs), extra = (box.w - nat.reduce((a, b) => a + b, 0)) / cols.length, widths = nat.map(w => w + Math.max(0, extra));
  const tblH = rowH * n, top = box.y + Math.max(0, box.h - tblH) * (spec.valign === 'top' ? 0 : 0.4);
  const cell = (text, w, c, st = {}) => h('div', sx(st, { width: w, height: rowH, alignItems: 'center', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', paddingLeft: fs * 0.8, paddingRight: fs * 0.8, whiteSpace: 'nowrap', overflow: 'hidden' }), text);
  const header = h('div', { position: 'absolute', left: box.x, top, width: box.w, height: rowH, borderBottom: `2px solid ${th.text.small}` },
    ...cols.map((c, ci) => cell(c.label.toUpperCase(), widths[ci], c, sx(th.f('subheading'), { fontSize: fs * 0.72, letterSpacing: fs * 0.08, color: th.text.small }))));
  const body = rows.map((r, ri) => h('div', { position: 'absolute', left: box.x, top: top + rowH * (ri + 1), width: box.w, height: rowH,
      background: r.highlight ? `${th.text.accent}1f` : ri % 2 ? th.surface + '88' : undefined, borderBottom: `1px solid ${th.hairline}`, borderLeft: r.highlight ? `4px solid ${th.text.accent}` : '4px solid transparent' },
    ...cols.map((c, ci) => {
      const v = r.cells[ci], isBest = best[ci] !== null && v === best[ci], t = hl.get(`${ri}:${ci}`);
      const color = t ? tone[t] : isBest ? tone.good : ci === 0 ? th.text.title : th.text.body;
      const st = sx(ci === 0 ? th.f('label') : th.f(c.mono === false ? 'body' : 'mono'), { fontSize: fs, color },
        (isBest || t) && { background: `${color}1c`, html: { fontWeight: 700 } });
      return cell(cellText(v, c), widths[ci], c, st);
    })));
  if (rowH < 30 * k) ctx.note(`rows are ${Math.round(rowH)}px tall; consider splitting the table across images`);
  return wrap([header, ...body]);
}
export default { name: 'table', describe: 'Dense table / benchmark matrix: 2–10 columns × up to 30 rows, auto font size, best-in-column (min|max), highlighted rows and cells.', validate, render };
