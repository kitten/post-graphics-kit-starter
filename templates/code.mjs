// Code-snippet hero: a short typeset excerpt (≤14 lines) with colors.nix syntax colours.
// This is typeset code, not an editor screenshot: no fake editor chrome, tabs, or UI.
import { h } from '../src/h.mjs';
import { theme, sx } from '../src/tokens.mjs';
import { fit, textWidth } from '../src/measure.mjs';
import { frame, titleLines, pill } from '../src/frame.mjs';
import { check, str, optStr, optPill } from '../src/validate.mjs';

const validate = spec => check(spec, [
  ['code', v => str(v) && v.split('\n').length <= 14, 'required string, at most 14 lines (trim to the interesting part)'],
  ['code', v => v.split('\n').every(l => l.length <= 72), 'lines must be ≤ 72 characters'],
  ['title', optStr, 'string'], ['eyebrow', optStr, 'string'], ['caption', optStr, 'string'], ['pill', optPill, 'string or { text, logo? }'],
  ['highlight', v => v === undefined || (Array.isArray(v) && v.every(Number.isInteger)), 'array of 1-based line numbers'],
]);

const KW = new Set('const let var function return if else for while do switch case break continue new class extends import export from default async await yield try catch finally throw typeof instanceof in of void delete this super type interface enum implements public private protected readonly static as satisfies keyof declare namespace module fn pub use mod impl struct trait match mut ref where self Self loop crate let rec inherit with assert or and not def lambda'.split(' '));
const CTRL = new Set(['return', 'if', 'else', 'for', 'while', 'throw', 'await', 'yield', 'break', 'continue', 'switch', 'case', 'match', 'try', 'catch']);
const CONST = new Set(['true', 'false', 'null', 'undefined', 'None', 'nil', 'NaN']);
const RE = /(\/\/.*$|#(?![{\[]).*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*(?:e[+-]?\d+)?[a-z]*\b)|([A-Za-z_$][\w$]*)|(=>|===|!==|==|!=|<=|>=|&&|\|\||\?\?|[-+*/%=<>!&|^~?:])|([{}()\[\];,.])|(\s+)|(.)/gm;
function tokenize(line, lang) {
  const out = []; let m; RE.lastIndex = 0;
  const hashComment = ['sh', 'bash', 'nix', 'py', 'python', 'yaml', 'toml', 'rb'].includes(lang);
  while ((m = RE.exec(line))) {
    const [t, com, s, n, id, op, p, ws] = m;
    if (com) { if (com.startsWith('#') && !hashComment) { out.push(['plain', '#']); RE.lastIndex = m.index + 1; continue; } out.push(['comment', t]); }
    else if (s) out.push(['string', t]); else if (n) out.push(['number', t]);
    else if (id) {
      const next = line.slice(RE.lastIndex).match(/^\s*(\(|<[^>]*>\()/), prev = out.filter(x => x[0] !== 'ws').at(-1)?.[1];
      out.push([CONST.has(t) ? 'constant' : CTRL.has(t) ? 'control' : KW.has(t) ? 'keyword' : next ? 'function' : /^[A-Z]/.test(t) ? 'type' : prev === '.' ? 'property' : 'plain', t]);
    } else if (op) out.push(['operator', t]); else if (p) out.push(['punct', t]); else if (ws) out.push(['ws', t]); else out.push(['plain', t]);
  }
  // Whitespace-only flex items collapse in browsers: glue whitespace onto the following token.
  const merged = []; let pend = '';
  for (const [k, t] of out) { if (k === 'ws') { pend += t; continue; } merged.push([k, pend + t]); pend = ''; }
  return merged;
}

function render(spec, { w: W, h: H, pad }, ctx) {
  const th = theme(spec, 'ember'), S = th.syntax, sq = H / W > 0.9, P = pad;
  const lines = spec.code.replace(/\t/g, '  ').replace(/\s+$/, '').split('\n');
  const hl = new Set(spec.highlight || []);
  let y = P; const head = [];
  if (spec.pill) { head.push(h('div', { marginBottom: 24 }, pill(th, spec.pill, { scale: 1.1 }))); y += 80; }
  if (spec.eyebrow) { head.push(h('div', sx(th.f('label'), { fontSize: 22, color: th.text.code, letterSpacing: 1, marginBottom: 14 }), (th.decor?.prompt ? th.decor.prompt + ' ' : '') + spec.eyebrow)); y += 36; }
  let ft;
  if (spec.title) { ft = fit(spec.title, th.fontRole('title'), { max: sq ? 84 : 72, min: 40, maxW: W - P * 2, maxLines: 2, tracking: -0.012 }); head.push(titleLines(th, th.fontRole('title'), ft, { lineHeight: 1.0, tracking: -0.012 })); y += ft.lines.length * ft.size + 8; if (ft.overflow) ctx.warn('title too long'); }
  const top = head.length ? y + (sq ? 56 : 40) : P;
  const bottom = (spec.caption ? 70 : 0) + P * (head.length ? 0.9 : 1);
  const panelW = W - P * 2, panelH = H - top - bottom, ip = 44;
  const mono = th.fontRole('mono'), gutter = String(lines.length).length;
  const longest = lines.reduce((a, l) => (l.length > a.length ? l : a), '');
  let fs = 40;
  while (fs > 16 && (textWidth(longest + ' '.repeat(gutter + 3), mono, fs) > panelW - ip * 2 || lines.length * fs * 1.5 > panelH - ip * 2)) fs -= 1;
  if (fs < 20) ctx.warn(`code font is ${fs}px; trim the snippet`);
  const lh = fs * 1.5, blockH = lines.length * lh;
  // Hug the content (with generous padding) and centre the panel in the space left below the title.
  const boxH = Math.min(panelH, Math.max(blockH + ip * 2.4, panelH * (sq ? 0.5 : 0.7))), boxTop = top + (panelH - boxH) * 0.4;
  const lineEl = (l, i) => h('div', { height: lh, alignItems: 'center', paddingLeft: ip, paddingRight: ip, background: hl.has(i + 1) ? 'rgba(215,192,70,0.10)' : undefined, borderLeft: `4px solid ${hl.has(i + 1) ? th.text.accent : 'transparent'}` },
    h('div', sx(th.f('mono'), { fontSize: fs, color: th.text.faint, width: textWidth('0'.repeat(gutter) + '  ', mono, fs), whiteSpace: 'pre' }), String(i + 1).padStart(gutter)),
    ...tokenize(l, spec.lang).map(([k, t]) => h('div', sx(th.f(k === 'keyword' || k === 'control' ? 'monoBold' : 'mono'), { fontSize: fs, whiteSpace: 'pre', color: k === 'ws' ? undefined : S[k] || S.plain }), t)));
  return frame(th, spec, W, H, [
    head.length > 0 && h('div', { position: 'absolute', left: P, top: P, flexDirection: 'column' }, ...head),
    h('div', { position: 'absolute', left: P, top: boxTop, width: panelW, height: boxH, background: th.surface, border: `1.5px solid ${th.hairline}`, borderRadius: 24, flexDirection: 'column', justifyContent: 'center',
        html: { boxShadow: '0 30px 80px rgba(0,0,0,0.45)' } },
      h('div', { flexDirection: 'column', height: blockH }, ...lines.map(lineEl))),
    spec.caption && h('div', sx(th.f('body'), { position: 'absolute', left: P, bottom: P * 0.7, maxWidth: W - P * 2 - 300, fontSize: 24, color: th.text.small }), spec.caption),
  ], { pad: P, avatarSize: 52, bylineSize: 24, bottom: P * 0.55 });
}
export default { name: 'code', describe: 'Code-snippet hero: ≤14 typeset lines with colors.nix syntax colours, optional title/pill/caption.', validate, render };
