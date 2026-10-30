// Title / OG card: optional pill (with Expo logo only for Expo posts), big title, optional subtitle.
import { h } from '../src/h.mjs';
import { theme, sx } from '../src/tokens.mjs';
import { fit } from '../src/measure.mjs';
import { frame, pill, titleLines } from '../src/frame.mjs';
import { check, str, optStr, optPill } from '../src/validate.mjs';

const validate = spec => check(spec, [
  ['title', str, 'required string (use \\n to force a line break)'],
  ['subtitle', optStr, 'must be a string'], ['eyebrow', optStr, 'must be a string'], ['pill', optPill, 'string or { text, logo?, dot? }'],
]);

function render(spec, { w: W, h: H, pad }, ctx) {
  const th = theme(spec, 'kitten'), sq = H / W > 0.9, P = pad * 1.25;
  const role = th.fontRole('title'), maxW = W - P * 2 - (sq ? 0 : 60);
  const ft = fit(spec.title, role, { max: sq ? 150 : 150, min: 56, maxW, maxLines: sq ? 5 : 3, tracking: -0.012 });
  if (ft.overflow) ctx.warn('title too long for the card; shorten it');
  const sub = spec.subtitle && fit(spec.subtitle, th.fontRole('body'), { max: sq ? 40 : 38, min: 24, maxW: maxW * 0.9, maxLines: 3 });
  const prompt = th.decor?.prompt;
  return frame(th, spec, W, H, [
    h('div', { position: 'absolute', left: P, top: 0, width: W - P * 2, height: H, flexDirection: 'column', justifyContent: 'center' },
      spec.pill && h('div', { marginBottom: sq ? 52 : 44 }, pill(th, spec.pill, { scale: sq ? 1.75 : 1.6, variant: th.name === 'kitten' || th.name === 'ember' ? 'light' : undefined })),
      spec.eyebrow && h('div', sx(th.f('label'), { fontSize: 28, color: th.text.code, letterSpacing: 1, marginBottom: 26 }), (prompt ? prompt + ' ' : '') + spec.eyebrow),
      titleLines(th, role, ft, { lineHeight: 0.98, tracking: -0.012, accentLast: !!spec.accentLast }),
      th.decor?.cursor && h('div', { width: ft.size * 0.5, height: ft.size * 0.12, background: th.text.prompt || th.text.accent, marginTop: 18 }),
      sub && h('div', { flexDirection: 'column', marginTop: sq ? 48 : 40 }, ...sub.lines.map(l => h('div', sx(th.f('body'), { fontSize: sub.size, lineHeight: 1.3, color: th.text.small, whiteSpace: 'nowrap' }), l)))),
  ], { pad: P * 0.6, avatarSize: sq ? 92 : 84, bylineSize: 28 });
}
export default { name: 'title', describe: 'Title / OG card: pill, big title, subtitle, byline + avatar.', validate, render };
