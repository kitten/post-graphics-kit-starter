// Mermaid → themed SVG, rendered in the kit's own Chromium with Mermaid + ELK served from node_modules
// via request interception (fake origin http://kit.local/), so nothing is fetched from a CDN at render time.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROOT, T } from './tokens.mjs';
import { getBrowser, htmlFaces } from './engines.mjs';

const MOUNTS = { '/mermaid/': 'node_modules/mermaid/dist/', '/elk/': 'node_modules/@mermaid-js/layout-elk/dist/' };
const STACK = { tailrecursive: 'tailrecursive, Recursive, ui-monospace, monospace', InterVar: 'InterVar, Inter, system-ui, sans-serif', JBMonoVar: 'JBMonoVar, "JetBrains Mono", ui-monospace, monospace' };
const FAMILY = { tailrecursive: 'tailrecursive', inter: 'InterVar', 'jetbrains-mono': 'JBMonoVar' };

// CSS declarations for a kit font role (family stack, weight, variable axes).
export function fontDecl(role) {
  const r = T.fonts.roles[role], fam = FAMILY[r.source];
  const fvs = Object.entries(r.axes).filter(([k]) => k !== 'wght').map(([k, v]) => `"${k}" ${v}`).join(', ');
  return { stack: STACK[fam], css: `font-family:${STACK[fam]} !important;font-weight:${r.axes.wght} !important;font-variation-settings:${fvs || 'normal'};font-optical-sizing:none;` };
}
// rgba(...) → #rrggbbaa (Mermaid classDef values are comma-separated, so rgba() would break them).
export function hex8(c) {
  const m = /^rgba?\(([^)]+)\)$/.exec(String(c).trim()); if (!m) return c;
  const [r, g, b, a = 1] = m[1].split(',').map(Number), x = v => Math.round(v).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}${a < 1 ? x(a * 255) : ''}`;
}

export function mermaidTheme(th, { fontSize = 18 } = {}) {
  const D = th.diagram, G = D.group || { fill: th.surface, border: th.hairline, text: th.text.small }, S = th.chart.series || [];
  const node = fontDecl(th.fontRole('node')), strong = fontDecl(th.fontRole('nodeStrong')), mono = fontDecl(th.fontRole('label')), head = fontDecl(th.fontRole('subheading'));
  const tv = {
    darkMode: true, background: th.bg, fontFamily: node.stack, fontSize: `${fontSize}px`,
    primaryColor: hex8(D.normal.fill), primaryBorderColor: D.normal.border, primaryTextColor: D.normal.text,
    secondaryColor: hex8(D.path.fill), secondaryBorderColor: D.path.border, secondaryTextColor: D.path.text,
    tertiaryColor: hex8(D.local.fill), tertiaryBorderColor: D.local.border, tertiaryTextColor: D.local.text,
    lineColor: D.lines, textColor: th.text.body, titleColor: th.text.heading, mainBkg: hex8(D.normal.fill), nodeBorder: D.normal.border, nodeTextColor: D.normal.text,
    clusterBkg: hex8(G.fill), clusterBorder: hex8(G.border), edgeLabelBackground: th.bg, labelBackground: th.bg,
    noteBkgColor: th.surface, noteTextColor: th.text.body, noteBorderColor: th.text.accent,
    errorBkgColor: hex8(D.conflict.fill), errorTextColor: D.conflict.text,
    // sequence
    actorBkg: hex8(D.normal.fill), actorBorder: D.normal.border, actorTextColor: D.normal.text, actorLineColor: th.hairline,
    signalColor: D.lines, signalTextColor: th.text.body, labelBoxBkgColor: th.surface, labelBoxBorderColor: hex8(G.border), labelTextColor: th.text.body,
    loopTextColor: th.text.small, activationBkgColor: hex8(D.path.fill), activationBorderColor: D.path.border, sequenceNumberColor: th.bg,
    // state / class / ER
    altBackground: th.surface, compositeBackground: hex8(G.fill), compositeTitleBackground: hex8(G.fill), stateBorder: D.normal.border, transitionColor: D.lines, transitionLabelColor: th.text.body,
    specialStateColor: D.lines, innerEndBackground: D.lines, classText: D.normal.text,
    attributeBackgroundColorOdd: th.surface, attributeBackgroundColorEven: th.bg,
    // gantt
    sectionBkgColor: hex8(G.fill), altSectionBkgColor: 'transparent', sectionBkgColor2: hex8(G.fill),
    taskBkgColor: hex8(D.normal.fill), taskBorderColor: D.normal.border, taskTextColor: D.normal.text, taskTextLightColor: D.normal.text, taskTextDarkColor: D.normal.text, taskTextOutsideColor: th.text.body, taskTextClickableColor: th.text.code,
    activeTaskBkgColor: hex8(D.local.fill), activeTaskBorderColor: D.local.border, doneTaskBkgColor: th.surface, doneTaskBorderColor: th.hairline,
    critBkgColor: hex8(D.conflict.fill), critBorderColor: D.conflict.border, gridColor: th.hairline, todayLineColor: th.text.accent, excludeBkgColor: th.surface,
    // pie / journey / timeline / mindmap palettes
    pieTitleTextColor: th.text.heading, pieSectionTextColor: th.bg, pieLegendTextColor: th.text.body, pieStrokeColor: th.bg, pieOuterStrokeColor: th.hairline, pieOpacity: '1',
    xyChart: { backgroundColor: 'transparent', titleColor: th.text.heading, xAxisLabelColor: th.text.small, xAxisTitleColor: th.text.small, xAxisTickColor: th.hairline, xAxisLineColor: th.hairline,
      yAxisLabelColor: th.text.small, yAxisTitleColor: th.text.small, yAxisTickColor: th.hairline, yAxisLineColor: th.hairline, plotColorPalette: S.join(', ') },
    quadrant1Fill: th.surface, quadrant2Fill: th.surface, quadrant3Fill: th.surface, quadrant4Fill: th.surface, quadrantPointFill: th.text.accent, quadrantTitleFill: th.text.heading,
  };
  S.forEach((c, i) => { tv['pie' + (i + 1)] = c; tv['git' + i] = c; });
  // cScale drives timeline / mindmap / journey sections: tinted fills, coloured borders/labels.
  const tint = c => hex8(c.startsWith('#') ? `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},0.16)` : c);
  for (let i = 0; i < 12; i++) { const c = S[i % S.length] || D.normal.border; tv['cScale' + i] = tint(c); tv['cScalePeer' + i] = c; tv['cScaleLabel' + i] = D.normal.text; tv['cScaleInv' + i] = c; }

  const shadow = D.shadow ? `filter:drop-shadow(${D.shadow.replace(/^(\S+) (\S+) (\S+) /, '$1 $2 0 ')});` : '';
  const css = `
    .nodeLabel, .nodeLabel p, .label, .label text, span, p, text, .messageText, .actor, .actor tspan, .taskText, .sectionTitle, .titleText, .classTitle, .cluster-label { ${node.css} }
    .edgeLabel, .edgeLabel p, .edgeLabel span, .labelText, .loopText, .loopText tspan, .messageText, .tick text, .grid .tick text { ${mono.css} }
    .edgeLabel, .edgeLabel p, .edgeLabel span, .messageText { color:${th.text.code} !important; fill:${th.text.code} !important; }
    .edgeLabel rect, .labelBkg { fill:${th.bg} !important; background:${th.bg} !important; opacity:1 !important; }
    .edgeLabel p { background:${th.bg} !important; padding:1px 6px; border-radius:4px; }
    .cluster-label, .cluster-label span, .cluster-label p, .cluster-label .nodeLabel { ${head.css} color:${G.text} !important; fill:${G.text} !important; letter-spacing:0.5px; }
    .cluster rect { rx:${T.radii.node + 4}px; ry:${T.radii.node + 4}px; stroke-width:2px; ${G.dashed ? 'stroke-dasharray:8 6;' : ''} }
    .node rect, .node polygon, .node circle, .node path.basic, .node .label-container { stroke-width:2.5px; }
    .node rect.basic, .node rect.label-container, rect.actor, rect.task { rx:${T.radii.node}px; ry:${T.radii.node}px; }
    .flowchart-link, .edgePath .path, .relation, .transition, .messageLine0, .messageLine1 { stroke-width:2.5px; }
    .arrowheadPath, marker path { fill:${D.lines} !important; stroke:${D.lines} !important; }
    .actor-line { stroke:${th.hairline} !important; stroke-dasharray:4 6; }
    .note, rect.note { rx:6px; ry:6px; }
    .classTitle, .nodeLabel strong, .classTitleText, .node.header .nodeLabel, .node.header .nodeLabel p, .node.badge .nodeLabel, .node.badge .nodeLabel p { ${strong.css} }
    .tick text, .grid .tick text { font-size:${Math.round(fontSize * 0.8)}px !important; fill:${th.text.small} !important; }
    .sequenceNumber { --nl:1; }
    .link { mix-blend-mode:normal !important; stroke-opacity:0.42 !important; }
    .node-labels text { font-size:${Math.round(fontSize * 0.85)}px; fill:${th.text.body}; }
    .plot path[fill="none"] { stroke-width:4px; }
    .grid .tick line, .grid path { stroke:${th.hairline} !important; opacity:0.6; }
    .sectionTitle, .titleText { fill:${th.text.small} !important; }
    .er.entityBox, .er .entityBox { fill:${hex8(D.normal.fill)}; stroke:${D.normal.border}; }
    ${['local', 'conflict', 'path'].map(r => `g.classGroup.${r} path:first-child, g.node.${r}.default > g > path:first-child { fill:${hex8(D[r].fill)} !important; stroke:${D[r].border} !important;${D[r].dashed ? ' stroke-dasharray:7 5;' : ''} }
    g.node.${r} > g > path { stroke:${D[r].border} !important; } g.node.${r}.default .nodeLabel, g.node.${r}.default .label { color:${D[r].text} !important; fill:${D[r].text} !important; }`).join('\n')}
    ${shadow ? `.node .label-container, .node rect, .node polygon, rect.actor, rect.task, .cluster rect { ${shadow} }` : ''}
  `.replace(/\n\s+/g, '\n');
  return { themeVariables: tv, themeCSS: css, fontFamily: node.stack };
}

// classDef lines for the kit's diagram roles, injected after the diagram header (flowchart/state/class).
export function roleClassDefs(th, kind) {
  const D = th.diagram, strong = T.fonts.roles[th.fontRole('nodeStrong')].axes.wght;
  const def = (name, r, extra = '') => `classDef ${name} fill:${hex8(r.fill)},stroke:${r.border || r.fill},color:${r.text}${r.dashed ? ',stroke-dasharray:7 5' : ''}${extra}`;
  const lines = [def('normal', D.normal), def('local', D.local), def('conflict', D.conflict), def('path', D.path), def('badge', D.badge, `,font-weight:${strong}`),
    def('header', D.normal, `,font-weight:${strong}`), def('muted', { fill: th.surface, border: th.hairline, text: th.text.faint }), def('dashed', { ...D.normal, dashed: true })];
  if (kind === 'class') return lines.filter(l => !/badge|header/.test(l));
  return lines;
}

export function diagramKind(src) {
  const first = src.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('%%')) || '';
  const k = first.split(/\s+/)[0];
  if (/^(flowchart|graph)$/.test(k)) return 'flowchart';
  if (/^stateDiagram/.test(k)) return 'state';
  if (k === 'classDiagram') return 'class';
  return k;
}

const fetchBody = path => {
  for (const [pre, dir] of Object.entries(MOUNTS)) if (path.startsWith(pre)) {
    const f = new URL(dir + path.slice(pre.length), ROOT);
    if (existsSync(f)) return readFileSync(f);
  }
  return null;
};

let pagePromise;
async function mermaidPage() {
  if (pagePromise) { const p = await pagePromise.catch(() => null); if (p && !p.isClosed()) return p; pagePromise = undefined; }
  return (pagePromise = (async () => {
    const page = await (await getBrowser()).newPage({ viewport: { width: 2400, height: 1600 } });
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.host !== 'kit.local') return route.abort(); // no network at render time
      if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${htmlFaces()}body{margin:0;background:#000}</style><div id="c"></div>
        <script type="module">import mermaid from '/mermaid/mermaid.esm.min.mjs'; import elk from '/elk/mermaid-layout-elk.esm.min.mjs';
        mermaid.registerLayoutLoaders(elk); window.mermaid = mermaid; window.__ready = true;</script>` });
      const body = fetchBody(u.pathname);
      return body ? route.fulfill({ body, contentType: u.pathname.endsWith('js') ? 'text/javascript' : 'application/octet-stream' }) : route.fulfill({ status: 404, body: 'not found' });
    });
    await page.goto('http://kit.local/');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    await page.evaluate(() => Promise.all(['InterVar', 'tailrecursive', 'JBMonoVar'].flatMap(f => [400, 500, 700].map(w => document.fonts.load(`${w} 18px ${f}`)))));
    return page;
  })());
}
export async function closeMermaid() { if (pagePromise) { const p = await pagePromise; pagePromise = undefined; await p.close().catch(() => {}); } }

let seq = 0;
// Returns { svg, w, h, kind, layout }.
// fit: { w, h } of the target box, so width-driven types (gantt, xychart, sankey) lay out at 1:1 instead of being scaled.
export async function renderMermaid(source, th, { layout = 'auto', look = 'classic', fontSize = 18, config = {}, roles = true, fit } = {}) {
  const kind = diagramKind(source);
  let src = source.trim();
  if (roles && ['flowchart', 'state', 'class'].includes(kind)) {
    const lines = src.split('\n'), i = lines.findIndex(l => l.trim() && !l.trim().startsWith('%%'));
    lines.splice(i + 1, 0, ...roleClassDefs(th, kind).map(l => '  ' + l));
    src = lines.join('\n');
  }
  const big = (src.match(/-->|---|-\.->|==>|--\s/g) || []).length > 12 || /\bsubgraph\b/.test(src);
  const lay = layout === 'auto' ? (kind === 'flowchart' && big ? 'elk' : 'dagre') : layout;
  const { themeVariables, themeCSS, fontFamily } = mermaidTheme(th, { fontSize });
  const nomax = { useMaxWidth: false };
  const cfg = {
    startOnLoad: false, securityLevel: 'strict', theme: 'base', look, layout: lay, themeVariables, themeCSS, fontFamily, fontSize, deterministicIds: true, deterministicIDSeed: 'kit',
    elk: { mergeEdges: false, nodePlacementStrategy: 'BRANDES_KOEPF', cycleBreakingStrategy: 'GREEDY_MODEL_ORDER', considerModelOrder: 'NODES_AND_EDGES' },
    flowchart: { ...nomax, htmlLabels: true, padding: 12, nodeSpacing: 30, rankSpacing: 40, diagramPadding: 8, curve: 'basis', wrappingWidth: 260 },
    sequence: { ...nomax, mirrorActors: false, actorMargin: 60, messageMargin: 34, boxMargin: 10, noteMargin: 12, actorFontSize: fontSize, messageFontSize: fontSize - 2, noteFontSize: fontSize - 2, wrap: true, width: 180 },
    class: { ...nomax, htmlLabels: true, padding: 10 }, state: { ...nomax, padding: 10 }, er: { ...nomax, fontSize, entityPadding: 16 },
    gantt: { ...nomax, ...(fit ? { useWidth: Math.round(fit.w) } : {}), fontSize, sectionFontSize: fontSize, barHeight: 34, barGap: 10, topPadding: 60, leftPadding: 180, gridLineStartPadding: 40, axisFormat: '%b %d' },
    timeline: { ...nomax, padding: 10 }, mindmap: { ...nomax, padding: 14 }, journey: nomax, pie: nomax, gitGraph: nomax, quadrantChart: nomax, requirement: nomax,
    xyChart: { ...nomax, width: Math.round(fit?.w ?? 1100), height: Math.round(fit?.h ?? 560), titleFontSize: fontSize + 4, showDataLabel: false,
      xAxis: { labelFontSize: Math.round(fontSize * 0.85), titleFontSize: fontSize }, yAxis: { labelFontSize: Math.round(fontSize * 0.85), titleFontSize: fontSize } }, sankey: { ...nomax, width: Math.round(fit?.w ?? 1100), height: Math.round(fit?.h ?? 560), linkColor: 'gradient', nodeAlignment: 'justify' },
    ...config,
  };
  const page = await mermaidPage();
  const id = `kitm${++seq}`;
  const r = await page.evaluate(async ([cfg, src, id]) => {
    window.mermaid.initialize(cfg);
    try {
      const { svg } = await window.mermaid.render(id, src);
      const c = document.getElementById('c'); c.innerHTML = svg;
      const el = c.querySelector('svg'), vb = el.viewBox.baseVal;
      const out = { svg, w: vb?.width || el.getBBox().width, h: vb?.height || el.getBBox().height }; c.innerHTML = ''; return out;
    } catch (e) { return { error: String(e?.message || e) }; }
  }, [cfg, src, id]);
  if (r.error) throw new Error(`mermaid (${kind}): ${r.error.split('\n').slice(0, 4).join('\n')}`);
  return { ...r, kind, layout: lay };
}

// Fit the Mermaid SVG into w×h CSS px: fixed width/height, viewBox kept.
export function sizedSVG(svg, w, h) {
  return svg.replace(/<svg([^>]*?)>/, (m, attrs) => '<svg' + attrs.replace(/\s(width|height)="[^"]*"/g, '').replace(/style="[^"]*"/, '') + ` width="${w.toFixed(1)}" height="${h.toFixed(1)}" style="display:block;overflow:hidden">`);
}
export const MERMAID_ROOT = fileURLToPath(ROOT);
