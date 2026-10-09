// Assemble the standalone HTML page around a rendered SVG body.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { el, esc } from './svg.mjs';
import { FONTS_HREF, DIAGRAM_CSS, SKINS, ON_FILL, skinCss } from './tokens.mjs';
import { cleanFonts } from './config/config.mjs';
import { watermarkOn, watermarkSvg, MARK, FAVICON } from './mark.mjs';
import { MOTION_CSS, motionVars } from './motion.mjs';
import { VIEWER_CSS } from './viewer/viewer.css.mjs';

const CLIENT = readFileSync(fileURLToPath(new URL('./viewer/viewer.client.js', import.meta.url)), 'utf8');
const SIZE_MAX = { auto: 1200, wide: 1400, slide: 1280, square: 900 };

export function slugify(s) {
  return String(s || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'diagram';
}

export function buildPage({ spec, result, preset, typeName, settings = {} }) {
  const sketchy = (spec.style || settings.style) === 'sketchy';
  const mark = watermarkOn(spec, settings);
  const [vx, vy, vw, vh0] = result.viewBox.map((v) => Math.round(v));
  // the watermark gets its own strip under the diagram, so it never covers content
  const vh = mark ? vh0 + MARK.strip : vh0;
  const slug = slugify(spec.title || spec.type);
  const title = spec.title || typeName;
  const desc = spec.subtitle || `${typeName} diagram${result.graph ? ` with ${result.graph.nodes.length} elements` : ''}.`;
  const motionAttr = preset && preset !== 'none' ? preset : undefined;
  const interactive = result.graph && result.graph.nodes.length > 0;
  const svg = el('svg', {
    class: `sc-svg${sketchy ? ' sc-sketchy' : ''}`,
    xmlns: 'http://www.w3.org/2000/svg',
    'xmlns:xlink': mark ? 'http://www.w3.org/1999/xlink' : undefined,
    viewBox: `${vx} ${vy} ${vw} ${vh}`,
    role: 'img',
    'aria-labelledby': `${slug}-title ${slug}-desc`,
    'data-sc-type': spec.type,
    'data-sc-motion': motionAttr,
    'data-sc-slug': slug,
    'data-sc-steps': result.steps || 0,
    style: [motionAttr ? motionVars(preset, result.steps || 1) : '', `max-width:${Math.round(vw * 1.25)}px`].filter(Boolean).join(';'),
  }, [
    el('desc', { id: `${slug}-desc` }, esc(desc)),
    sketchy ? el('defs', {}, el('filter', { id: `${slug}-sketch`, filterUnits: 'userSpaceOnUse', x: vx, y: vy, width: vw, height: vh }, [
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: 2, seed: 7, result: 'n' }),
      el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 2.6, xChannelSelector: 'R', yChannelSelector: 'G' }),
    ])) : '',
    el('rect', { class: 'sc-bg', x: vx, y: vy, width: vw, height: vh }),
    sketchy ? `<style>.sc-sketchy .n-box,.sc-sketchy .e-line,.sc-sketchy .g-box,.sc-sketchy .e-head,.sc-sketchy .e-glyph,.sc-sketchy .lane-band,.sc-sketchy .c-bar,.sc-sketchy .sk-link,.sc-sketchy .venn-c,.sc-sketchy .q-frame,.sc-sketchy .tm-cell{filter:url(#${slug}-sketch)}.sc-sketchy .n-label,.sc-sketchy .venn-label{font-family:'Kalam','Comic Neue',cursive;font-weight:700}</style>` : '',
    result.body,
    mark ? watermarkSvg([vx, vy, vw, vh], slug) : '',
  ]);
  const tokenNames = [...Object.keys(SKINS.light), ...ON_FILL.map((v) => `on-${v}`), 'font-serif', 'font-sans', 'font-mono'].map((k) => `--sc-${k}`).join(',');
  const bar = [
    interactive ? '<input class="sc-search" type="search" placeholder="Find node…" aria-label="Find node">' : '',
    '<span class="sc-spacer"></span>',
    motionAttr ? '<button class="sc-btn" data-sc-action="prev" title="Previous step (←)" aria-label="Previous step">◀</button><button class="sc-btn" data-sc-action="next" title="Next step (→)" aria-label="Next step">▶</button><button class="sc-btn" data-sc-action="replay" title="Replay animation">Replay</button><button class="sc-btn" data-sc-action="live" aria-pressed="true" title="Toggle motion">Live</button>' : '',
    interactive ? '<button class="sc-btn" data-sc-action="path" aria-pressed="false" title="Trace a route: pick two nodes">Path</button>' : '',
    interactive ? '<div class="sc-menu sc-lens"><button class="sc-btn" data-sc-action="lens" aria-haspopup="true" title="Highlight one kind">Lens</button><div class="sc-menu-list" role="menu"></div></div>' : '',
    '<button class="sc-btn" data-sc-action="map" aria-pressed="false" title="Overview map">Map</button>',
    '<button class="sc-btn" data-sc-action="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><button class="sc-btn" data-sc-action="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>',
    '<button class="sc-btn" data-sc-action="full" aria-pressed="false" title="Full screen (F)">Full screen</button>',
    spec.skin === 'terminal' ? '' : '<button class="sc-btn sc-theme" data-sc-action="theme" role="switch" aria-checked="false" title="Dark mode"><span class="sc-switch" aria-hidden="true"></span>Dark</button>',
    '<div class="sc-menu sc-export"><button class="sc-btn" data-sc-action="export" aria-haspopup="true">Export</button><div class="sc-menu-list" role="menu">'
      + '<button data-sc-export="png" role="menuitem">PNG</button><button data-sc-export="jpeg" role="menuitem">JPEG</button>'
      + '<button data-sc-export="svg" role="menuitem">SVG (vector)</button><button data-sc-export="gif" role="menuitem">GIF (animated)</button>'
      + '<button data-sc-export="mp4" role="menuitem">MP4 (video)</button><button data-sc-export="copy" role="menuitem">Copy PNG</button></div></div>',
  ].join('');
  const evidence = spec.evidence && spec.evidence.length
    ? `<details class="sc-evidence"><summary>Sources (${spec.evidence.length})</summary>${spec.evidence
        .map((e) => `<div>${esc(e.id)} — <code>${esc(e.file)}${e.line ? ':' + e.line : ''}</code>${e.note ? ' · ' + esc(e.note) : ''}</div>`)
        .join('')}</details>`
    : '';
  const brand = { ...(settings.brand || {}) };
  if (brand.fonts) brand.fonts = cleanFonts(brand.fonts);
  const brandFonts = brand.fonts || {};
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="SeeCode">
<link rel="icon" type="image/png" href="${FAVICON()}">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="sc-fonts" rel="stylesheet" href="${esc(FONTS_HREF)}${sketchy ? '&amp;family=Kalam:wght@400;700' : ''}">${(brandFonts.href || []).map((h) => `
<link class="sc-brand-fonts" rel="stylesheet" href="${esc(h)}">`).join('')}${brandFonts.faces ? `
<style id="sc-brand-faces">${brandFonts.faces}</style>` : ''}
<style>${skinCss({ skin: spec.skin || settings.skin || 'light', brand })}
:root{--sc-max:${SIZE_MAX[spec.size || 'auto'] || 1200}px}
${VIEWER_CSS}</style>
<style id="sc-diagram-css">${DIAGRAM_CSS}${MOTION_CSS}</style>
<script type="text/plain" id="sc-token-names">${tokenNames}</script>
<script type="application/json" id="sc-meta">${JSON.stringify({
    type: typeName,
    groups: Object.fromEntries((result.graph?.nodes || []).filter((n) => n.group).map((n) => [n.id, n.group])),
    evidence: (spec.evidence || []).reduce((m, e) => ((m[e.id] = m[e.id] || []).push({ file: e.file, line: e.line, note: e.note }), m), {}),
  }).replace(/</g, '\\u003c')}</script>
</head>
<body>
<main class="sc-page">
<header class="sc-head">
${spec.eyebrow !== '' ? `<p class="sc-eyebrow">${esc(spec.eyebrow || typeName)}</p>` : ''}
<h1 class="sc-title" id="${slug}-title">${esc(title)}</h1>
${spec.subtitle ? `<p class="sc-subtitle">${esc(spec.subtitle)}</p>` : ''}
</header>
<nav class="sc-bar" aria-label="Diagram controls">${bar}</nav>
<figure class="sc-figure">
<div class="sc-stage">${svg}<div class="sc-tip" aria-hidden="true"></div>
<aside class="sc-panel" hidden aria-live="polite"></aside></div>
<div class="sc-grip" role="separator" aria-orientation="horizontal" aria-label="Resize canvas: drag, or use the arrow keys; double-click to reset" tabindex="0"></div>
${spec.caption ? `<figcaption class="sc-caption">${esc(spec.caption)}</figcaption>` : ''}
</figure>
<p class="sc-status" role="status" aria-live="polite"></p>
${evidence}
</main>
<script>${CLIENT}</script>
</body>
</html>
`;
}

