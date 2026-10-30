// Shared card chrome for data/diagram templates: eyebrow + title + subtitle on top, legend + source line at the bottom,
// byline/avatar footer. Returns the free content box so a template only lays out its body.
import { h } from './h.mjs';
import { sx, T } from './tokens.mjs';
import { fit, wrap, textWidth } from './measure.mjs';
import { frame, titleLines } from './frame.mjs';

export function card(th, spec, { w: W, h: H, pad }, ctx, { titleMax, legend } = {}) {
  const sq = H / W > 0.9, k = Math.min(1.25, Math.max(0.85, W / 1600));
  const head = []; let y = pad * (sq ? 0.95 : 0.8);
  if (spec.eyebrow) {
    head.push(h('div', sx(th.f('label'), { fontSize: 22 * k, color: th.text.code, letterSpacing: 1, marginBottom: 12 }), (th.decor?.prompt ? th.decor.prompt + ' ' : '') + spec.eyebrow));
    y += 22 * k * 1.2 + 12;
  }
  if (spec.title) {
    const ft = fit(spec.title, th.fontRole('display'), { max: titleMax ?? (sq ? 60 : 54) * k, min: 32, maxW: W - pad * 2, maxLines: 2, tracking: -0.015 });
    if (ft.overflow) ctx.warn('title does not fit in 2 lines; shorten it');
    head.push(titleLines(th, th.fontRole('display'), ft, { lineHeight: 1.05, tracking: -0.015 }));
    y += ft.lines.length * ft.size * 1.05;
  }
  if (spec.subtitle) {
    const fs = 26 * k, lines = wrap(spec.subtitle, th.fontRole('body'), fs, W - pad * 2);
    if (lines.length > 2) ctx.warn('subtitle wraps past 2 lines; shorten it');
    head.push(h('div', sx(th.f('body'), { fontSize: fs, color: th.text.small, marginTop: 12, lineHeight: 1.3, maxWidth: W - pad * 2 }), spec.subtitle));
    y += 12 + Math.min(lines.length, 3) * fs * 1.3;
  }
  const top = head.length ? y + (sq ? 44 : 34) : pad;

  // Bottom: legend row (optional) above the source/caption line; footer (byline/avatar) at the right.
  const byline = (spec.byline === undefined ? th.byline : spec.byline), avatar = spec.avatar === undefined ? th.avatar : spec.avatar;
  const footW = (byline ? textWidth(byline, th.fontRole('body'), 24 * k) + 20 : 0) + (avatar ? 52 * k : 0) + 24;
  const src = spec.source || spec.caption;
  const bottomItems = [];
  let bottom = pad * 0.55 + (byline || avatar ? 52 * k : 0);
  if (src) {
    const fs = 19 * k, lines = wrap(src, th.fontRole('body'), fs, W - pad * 2 - footW);
    if (lines.length > 2) ctx.warn('source/caption wraps past 2 lines; shorten it');
    bottom = Math.max(bottom, pad * 0.55 + lines.length * fs * 1.3 + 8);
    bottomItems.push(h('div', sx(th.f('body'), { position: 'absolute', left: pad, bottom: pad * 0.55, maxWidth: W - pad * 2 - footW, fontSize: fs, lineHeight: 1.3, color: th.text.small, opacity: 0.85 }), src));
  }
  if (legend?.length) {
    const lg = legendRow(th, legend, k);
    bottomItems.push(h('div', { position: 'absolute', left: pad, bottom: bottom + 10, flexWrap: 'wrap', maxWidth: W - pad * 2 }, ...lg));
    bottom += 46 * k;
  }
  bottom += 18;
  const box = { x: pad, y: top, w: W - pad * 2, h: H - top - bottom };
  if (box.h < H * 0.4) ctx.warn(`header/footer leave only ${Math.round(box.h)}px for content; shorten title/subtitle or use a taller size`);
  const wrapUp = children => frame(th, spec, W, H, [
    head.length > 0 && h('div', { position: 'absolute', left: pad, top: pad * (sq ? 0.95 : 0.8), flexDirection: 'column' }, ...head),
    ...children, ...bottomItems,
  ], { pad, bylineSize: 24 * k, avatarSize: 52 * k, bottom: pad * 0.55 - 8 });
  return { box, wrap: wrapUp, sq, k };
}

// legend: [{ label, color } | { label, kind }] → swatches. kind = a diagram role (normal/local/conflict/path) or 'group'.
export function legendRow(th, items, k = 1) {
  const D = th.diagram;
  return items.map(it => {
    const r = it.kind ? (D[it.kind] || D.normal) : null;
    const sw = r
      ? h('div', { width: 30 * k, height: 20 * k, borderRadius: 5, background: r.fill, border: `2px ${r.dashed || it.dashed ? 'dashed' : 'solid'} ${r.border}`, marginRight: 10 })
      : it.line
        ? h('div', { width: 30 * k, height: 0, borderTop: `3px ${it.dashed ? 'dashed' : 'solid'} ${it.color}`, marginRight: 10 })
        : h('div', { width: 18 * k, height: 18 * k, borderRadius: 4, background: it.color, marginRight: 10 });
    return h('div', { alignItems: 'center', marginRight: 30, marginBottom: 6 }, sw,
      h('div', sx(th.f('label'), { fontSize: 19 * k, color: th.text.body, whiteSpace: 'nowrap' }), it.label));
  });
}

// Pick the kit size that gives the largest effective scale for natural content w×h (used for "try --size" hints).
export function bestSize(natW, natH, reserveFrac = 0.3) {
  let best;
  for (const [key, z] of Object.entries(T.sizes)) {
    const s = Math.min((z.w - z.pad * 2) / natW, (z.h * (1 - reserveFrac)) / natH) * (T.legibility.refWidth / z.w);
    if (!best || s > best.s) best = { key, s };
  }
  return best;
}
