// One vnode tree -> Satori element objects or an HTML string.
// style.html  = CSS only the browser engine supports (filters, blend modes, font-variation-settings...)
// style.satori = overrides applied only for Satori (static font family names, fallbacks).
export const h = (type, style = {}, ...children) => ({ type, props: { style, children: children.flat(Infinity).filter(c => c !== null && c !== false && c !== undefined && c !== '') } });
export const img = (src, style) => ({ type: 'img', props: { src, style, width: style.width, height: style.height } });

// raw(html, style): pre-built markup (e.g. a themed Mermaid SVG). Browser engine only.
export const raw = (html, style = {}) => ({ type: 'raw', props: { html, style } });

const UNITLESS = new Set(['fontWeight', 'opacity', 'flex', 'flexGrow', 'flexShrink', 'zIndex', 'lineHeight']);
const kebab = k => k.startsWith('Webkit') ? '-webkit-' + kebab(k.slice(6)).replace(/^-/, '') : k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
const css = s => Object.entries(s).filter(([k, v]) => k !== 'html' && k !== 'satori' && v !== undefined)
  .map(([k, v]) => `${kebab(k)}:${typeof v === 'number' && !UNITLESS.has(k) ? v + 'px' : v}`).join(';');

export function toSatori(n) {
  if (typeof n !== 'object') return String(n);
  if (n.type === 'raw') throw new Error('this graphic embeds browser-only markup (e.g. Mermaid); use --engine html');
  const { style = {}, children = [], ...rest } = n.props;
  const { html, satori, ...s } = style;
  const out = { boxSizing: 'border-box', ...(n.type === 'div' && !s.display ? { display: 'flex' } : {}), ...s, ...(satori || {}) };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return { type: n.type, props: { ...rest, style: out, children: children.map(toSatori) } };
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function toHTML(n) {
  if (typeof n !== 'object') return esc(n);
  const { style = {}, children = [], src } = n.props;
  const s = { ...(n.type === 'div' && !style.display ? { display: 'flex' } : {}), ...style, ...(style.html || {}) };
  const st = css(s).replace(/"/g, '&quot;');
  if (n.type === 'raw') return `<div style="${st}">${n.props.html}</div>`;
  if (n.type === 'img') return `<img src="${src}" style="${st}">`;
  return `<${n.type} style="${st}">${children.map(toHTML).join('')}</${n.type}>`;
}
