// Shared chrome: background + pattern, pill, byline/avatar footer, placeholder stamp.
import { readFileSync } from 'node:fs';
import { h, img } from './h.mjs';
import { ROOT, sx } from './tokens.mjs';

const dataURI = (file, mime) => `data:${mime};base64,${readFileSync(new URL(file, ROOT)).toString('base64')}`;
const memo = {}; const asset = (f, m) => (memo[f] ??= dataURI(f, m));
export const LOGOS = { expo: { file: 'assets/expo/logo-type-a.svg', ratio: 24 / 22 }, 'expo-wordmark': { file: 'assets/expo/logo-wordmark.svg', ratio: 114 / 32 } };
export const svgURI = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

function pattern(th, W, H) {
  if (th.pattern === 'grid') {
    let p = '';
    for (let x = 0; x <= W; x += 40) p += `<path d="M${x} 0V${H}" stroke="${x % 200 === 0 ? th.gridMajor : th.gridColor}" stroke-width="1"/>`;
    for (let y = 0; y <= H; y += 40) p += `<path d="M0 ${y}H${W}" stroke="${y % 200 === 0 ? th.gridMajor : th.gridColor}" stroke-width="1"/>`;
    return img(svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${p}</svg>`), { position: 'absolute', left: 0, top: 0, width: W, height: H });
  }
  if (th.pattern === 'scanlines') {
    let p = ''; for (let y = 0; y < H; y += 4) p += `<rect x="0" y="${y}" width="${W}" height="1" fill="rgba(237,240,242,0.025)"/>`;
    return img(svgURI(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${p}</svg>`), { position: 'absolute', left: 0, top: 0, width: W, height: H });
  }
  return null;
}
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .045 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`;

export function frame(th, spec, W, H, children, opts = {}) {
  const glow = `radial-gradient(${Math.round(W * 0.9)}px ${Math.round(H * 0.8)}px at 12% -8%, ${th.bgGlow} 0%, ${th.bg} 70%)`;
  return h('div', { width: W, height: H, position: 'relative', backgroundColor: th.bg, backgroundImage: glow, color: th.text.body, overflow: 'hidden',
      html: th.pattern === 'grain' ? { backgroundImage: `${GRAIN}, ${glow}` } : {} },
    pattern(th, W, H),
    ...children,
    opts.footer !== false && footer(th, spec, W, H, opts),
    spec.placeholder && h('div', sx(th.f('label'), { position: 'absolute', top: 14, left: 0, width: W, justifyContent: 'center' }),
      h('div', { html: { '--nl': '1' }, fontSize: 15, letterSpacing: 2, color: '#070d14', background: '#d7c046', padding: '4px 12px', borderRadius: 6 }, typeof spec.placeholder === 'string' ? spec.placeholder : 'PLACEHOLDER DATA — NOT REAL NUMBERS')));
}

export function footer(th, spec, W, H, opts = {}) {
  const byline = spec.byline === undefined ? th.byline : spec.byline;
  const avatar = spec.avatar === undefined ? th.avatar : spec.avatar;
  if (!byline && !avatar) return null;
  const pad = opts.pad ?? 72, size = opts.avatarSize ?? 64;
  return h('div', { position: 'absolute', right: pad, bottom: opts.bottom ?? pad - 16, alignItems: 'center' },
    byline && h('div', sx(th.f('body'), { fontSize: opts.bylineSize ?? 26, color: th.text.small, marginRight: avatar ? 20 : 0 }), byline),
    avatar && img(asset('assets/avatar.png', 'image/png'), { width: size, height: size, borderRadius: size / 2, border: `3px solid ${th.text.title}` }));
}

// pill: { text, logo?: 'expo', dot?: true }
export function pill(th, p, { scale = 1, variant } = {}) {
  if (!p) return null;
  p = typeof p === 'string' ? { text: p } : p;
  const logo = p.logo && LOGOS[p.logo];
  if (p.logo && !logo) throw new Error(`pill.logo: unknown logo "${p.logo}" (have: ${Object.keys(LOGOS).join(', ')})`);
  const fsz = 24 * scale;
  // A brand logo always sits on a light pill so the official black artwork is used unmodified.
  const light = logo || variant === 'light';
  const bg = light ? '#ffffff' : th.pill.bg, fg = light ? '#000000' : th.pill.text;
  return h('div', sx(th.f(light ? 'nodeStrong' : 'label'), { alignSelf: 'flex-start', alignItems: 'center', background: bg, color: fg, borderRadius: light ? 999 : 12 * scale,
      padding: `${12 * scale}px ${24 * scale}px`, fontSize: fsz, letterSpacing: light ? 1 : 3 * scale, border: th.pill.border && !light ? `1.5px solid ${th.pill.border}` : undefined,
      boxShadow: light ? '0 6px 18px rgba(0,0,0,0.45)' : undefined }),
    logo && img(asset(logo.file, 'image/svg+xml'), { width: fsz * 1.15 * logo.ratio, height: fsz * 1.15, marginRight: 14 * scale }),
    p.dot && !logo && h('div', { width: 10 * scale, height: 10 * scale, borderRadius: 5 * scale, background: th.text.accent, marginRight: 14 * scale, boxShadow: `0 0 12px ${th.text.accent}` }),
    h('div', {}, p.text));
}

// Title lines with the style's treatment (gradient clip + drop shadow where defined).
export function titleLines(th, role, fitted, { color, lineHeight = 1.0, tracking = 0, accentLast = false } = {}) {
  const grad = th.titleGradient;
  return h('div', { flexDirection: 'column' }, ...fitted.lines.map((l, i) => {
    const accent = accentLast && i === fitted.lines.length - 1 && fitted.lines.length > 1;
    const c = accent ? th.text.accent : (color || th.text.title);
    const g = grad && !accent ? { backgroundImage: `linear-gradient(180deg, ${grad.join(', ')})`, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', satori: { color: 'transparent' },
      html: { filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.55))' } } : {};
    return h('div', sx(th.f(role), { fontSize: fitted.size, lineHeight, letterSpacing: tracking * fitted.size, color: c, whiteSpace: 'nowrap' }, g), l);
  }));
}
