// Design tokens and the shared diagram stylesheet.
import { expandRoles, rgba } from './color.mjs';
// Every renderer emits class names only; colors live here as CSS custom
// properties so the light/dark toggle and skins never touch SVG markup.

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';

export const SKINS = {
  light: {
    paper: '#f6f5f1', 'paper-2': '#eceae4', ink: '#1d2433', 'ink-strong': '#0b0f19',
    muted: '#4a5568', soft: '#8a93a6', rule: 'rgba(29,36,51,0.12)', 'rule-solid': '#c9ccd3',
    accent: '#2f54eb', 'accent-tint': 'rgba(47,84,235,0.08)', link: '#0f7f81',
    node: '#ffffff', 'store': 'rgba(29,36,51,0.05)', external: 'rgba(29,36,51,0.025)',
    'series-1': '#6b8f71', 'series-2': '#c08a3e', 'series-3': '#8a6fb0', 'series-4': '#b5604b', 'series-5': '#5f7f9e',
  },
  // dark is a neutral #1a1a1a, never pure black
  dark: {
    paper: '#1a1a1a', 'paper-2': '#222222', ink: '#e8e6e3', 'ink-strong': '#f7f6f4',
    muted: '#a9a6a1', soft: '#75726e', rule: 'rgba(232,230,227,0.12)', 'rule-solid': 'rgba(232,230,227,0.24)',
    accent: '#7b93ff', 'accent-tint': 'rgba(123,147,255,0.14)', link: '#3cc6c4',
    node: '#202020', store: 'rgba(232,230,227,0.05)', external: 'rgba(232,230,227,0.025)',
    'series-1': '#8fb394', 'series-2': '#d9a95f', 'series-3': '#a993cc', 'series-4': '#d0806b', 'series-5': '#86a5c4',
  },
  terminal: {
    paper: '#1a1a1a', 'paper-2': '#222222', ink: '#f2f2f2', 'ink-strong': '#ffffff',
    muted: '#9a9a9a', soft: '#5c5c5c', rule: 'rgba(242,242,242,0.10)', 'rule-solid': '#2b2b2b',
    accent: '#39d98a', 'accent-tint': 'rgba(57,217,138,0.10)', link: '#5cc8ff',
    node: '#202020', store: 'rgba(242,242,242,0.04)', external: 'rgba(242,242,242,0.02)',
    'series-1': '#39d98a', 'series-2': '#5cc8ff', 'series-3': '#f5c542', 'series-4': '#ff7a59', 'series-5': '#b48cff',
  },
};

// Font stacks live in CSS variables so a brand profile can swap typefaces
// without touching the stylesheets. DEFAULT_FONTS are SeeCode's own.
export const DEFAULT_FONTS = {
  serif: "'Fraunces', 'Noto Serif', Georgia, serif",
  sans: "'IBM Plex Sans', 'Noto Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
};
export const FONT = { serif: 'var(--sc-font-serif)', sans: 'var(--sc-font-sans)', mono: 'var(--sc-font-mono)' };

// A brand family goes in front of SeeCode's stack, so missing glyphs or a
// blocked font still fall back to a font the layout was measured for.
export function fontStacks(brandFonts = {}) {
  const out = {};
  for (const role of ['serif', 'sans', 'mono']) {
    const fam = brandFonts[role] && (brandFonts[role].family || brandFonts[role]);
    out[`font-${role}`] = fam ? `'${String(fam).replace(/['"\\<>;{}]/g, '')}', ${DEFAULT_FONTS[role]}` : DEFAULT_FONTS[role];
  }
  return out;
}

// Type ramp (px) shared by every renderer.
export const TYPE = { label: 12, sub: 9, tag: 7, edge: 8, axis: 8, legend: 9, title: 13 };

function vars(skin) {
  return Object.entries(skin).map(([k, v]) => `--sc-${k}:${v};`).join('');
}

// A brand palette's roles become a full skin: with paper and ink given, every
// surface, rule and muted tone is derived from them so the brand is coherent.
function applyBrand(base, roles) {
  if (!roles || !Object.keys(roles).length) return base;
  if (roles.paper && roles.ink) return expandRoles(roles, base);
  return { ...base, ...roles, ...(roles.accent ? { 'accent-tint': rgba(roles.accent, 0.1) } : {}) };
}

// Brand: { accent, link, paper, ink, muted, dark?: {…} }. Dark mode uses the
// brand's dark palette when it has one, else keeps just its accent family.
// The resolved light and dark palettes for a skin + brand (terminal has one
// palette, used for both). Renderers that pick colours by contrast use these.
export function themePalettes({ skin = 'light', brand = {} } = {}) {
  const base = SKINS[skin] || SKINS.light;
  const { dark: darkBrand, light: lightBrand, fonts, ...flat } = brand || {};
  const light = applyBrand(base, lightBrand || flat);
  if (skin === 'terminal') return { light, dark: light };
  const dark = darkBrand ? applyBrand(SKINS.dark, darkBrand) : applyBrand(SKINS.dark, flat.accent ? { accent: flat.accent, ...(flat.link ? { link: flat.link } : {}) } : {});
  return { light, dark };
}

// Text on a filled cell (heatmap) can need light text in one theme and dark
// text in the other. Class vLD picks per theme (L = light theme, D = dark):
// 1 = white, 0 = black. Pure black/white keep >= 4.5:1 on any mid-tone fill,
// where the paper and ink tokens top out near 4:1.
export const ON_FILL = ['v00', 'v01', 'v10', 'v11'];
export const ON_FILL_TEXT = { 0: '#000000', 1: '#ffffff' };
function onFillVars(slot) {
  return Object.fromEntries(ON_FILL.map((v) => [`on-${v}`, ON_FILL_TEXT[v[slot]]]));
}

export function skinCss({ skin = 'light', brand = {} } = {}) {
  const { fonts } = brand || {};
  const type = fontStacks(fonts);
  const pal = themePalettes({ skin, brand });
  const light = { ...pal.light, ...onFillVars(1), ...type };
  const dark = { ...pal.dark, ...onFillVars(2), ...type };
  if (skin === 'terminal') {
    return `:root{${vars(light)}}`;
  }
  return `:root{${vars(light)}}
:root[data-theme="dark"]{${vars(dark)}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(dark)}}}`;
}

// Diagram stylesheet: classes used inside the SVG. Kept separate from the
// page/viewer CSS so the SVG export can embed exactly this block.
export const DIAGRAM_CSS = `
.sc-svg{font-family:${FONT.sans};color:var(--sc-ink);direction:ltr}
.sc-mark{opacity:.88;pointer-events:none}
.sc-mark-word{fill:var(--sc-ink)}
.sc-bg{fill:var(--sc-paper)}
.n-mask{fill:var(--sc-paper)}
.n-box{fill:var(--sc-node);stroke:var(--sc-ink);stroke-width:1}
.k-focal .n-box{fill:var(--sc-accent-tint);stroke:var(--sc-accent);stroke-width:1.2}
.k-store .n-box{fill:var(--sc-store);stroke:var(--sc-muted)}
.k-external .n-box{fill:var(--sc-external);stroke:var(--sc-soft)}
.k-input .n-box{fill:var(--sc-external);stroke:var(--sc-soft)}
.k-optional .n-box{fill:transparent;stroke:var(--sc-soft);stroke-dasharray:4 3}
.k-security .n-box{fill:var(--sc-accent-tint);stroke:var(--sc-accent);stroke-opacity:.55;stroke-dasharray:4 4}
.k-muted .n-box{fill:var(--sc-store);stroke:var(--sc-rule-solid)}
.n-label{fill:var(--sc-ink);font-size:12px;font-weight:600}
.n-sub{fill:var(--sc-muted);font-family:${FONT.mono};font-size:9px}
.n-tag{fill:var(--sc-soft);font-family:${FONT.mono};font-size:7px;letter-spacing:.12em;text-transform:uppercase}
.n-tag-box{fill:none;stroke:var(--sc-rule-solid);stroke-width:.8}
.k-focal .n-tag{fill:var(--sc-accent)}
.k-focal .n-tag-box{stroke:var(--sc-accent);stroke-opacity:.5}
.e-line{fill:none;stroke:var(--sc-muted);stroke-width:1.1}
.ek-primary .e-line{stroke:var(--sc-accent);stroke-width:1.4}
.ek-link .e-line{stroke:var(--sc-link);stroke-width:1.2}
.ek-async .e-line,.ek-return .e-line{stroke-width:1}
.ek-muted .e-line{stroke:var(--sc-soft);stroke-width:1}
.e-label{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.06em;text-transform:uppercase}
.ek-primary .e-label{fill:var(--sc-accent)}
.ek-link .e-label{fill:var(--sc-link)}
.e-label-bg{fill:var(--sc-paper)}
.m-default{fill:var(--sc-muted)}.m-primary{fill:var(--sc-accent)}.m-link{fill:var(--sc-link)}.m-muted{fill:var(--sc-soft)}
.g-box{fill:var(--sc-ink);fill-opacity:.018;stroke:var(--sc-rule);stroke-width:.8}
.g-box.g-dashed{stroke-dasharray:4 4;stroke:var(--sc-soft);stroke-opacity:.6}
.g-label{fill:var(--sc-soft);font-family:${FONT.mono};font-size:7px;letter-spacing:.16em;text-transform:uppercase}
.g-label-bg{fill:var(--sc-paper)}
.lg-rule{stroke:var(--sc-rule);stroke-width:.8}
.lg-title{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.18em}
.lg-text{fill:var(--sc-muted);font-size:9px}
.ax-line{stroke:var(--sc-rule-solid);stroke-width:1}
.ax-grid{stroke:var(--sc-rule);stroke-width:.8}
.ax-text{fill:var(--sc-soft);font-family:${FONT.mono};font-size:8px;letter-spacing:.04em}
.ax-label{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.16em;text-transform:uppercase}
.c-cat{fill:var(--sc-muted);font-size:10px}
.c-val{fill:var(--sc-ink);font-family:${FONT.mono};font-size:9px}
.c-bar{fill:var(--sc-muted);fill-opacity:.38}
.c-bar.is-focal{fill:var(--sc-accent);fill-opacity:1}
.c-val.is-focal{fill:var(--sc-accent);font-weight:500}
.s-1{fill:var(--sc-series-1)}.s-2{fill:var(--sc-series-2)}.s-3{fill:var(--sc-series-3)}.s-4{fill:var(--sc-series-4)}.s-5{fill:var(--sc-series-5)}
.sk-node{fill:var(--sc-muted)}
.sk-node.is-focal{fill:var(--sc-accent)}
.sk-link{fill:var(--sc-muted);fill-opacity:.14}
.sk-link.is-focal{fill:var(--sc-accent);fill-opacity:.28}
.sk-label{fill:var(--sc-ink);font-size:11px;font-weight:500;paint-order:stroke;stroke:var(--sc-paper);stroke-width:3px;stroke-linejoin:round}
.sk-val{fill:var(--sc-muted);font-family:${FONT.mono};font-size:9px;paint-order:stroke;stroke:var(--sc-paper);stroke-width:3px;stroke-linejoin:round}
.q-life{stroke:var(--sc-rule-solid);stroke-width:1;stroke-dasharray:3 4}
.q-frag{fill:none;stroke:var(--sc-soft);stroke-width:.8}
.q-frag-tag{fill:var(--sc-paper-2);stroke:var(--sc-soft);stroke-width:.8}
.q-frag-text{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.1em;text-transform:uppercase}
.q-num{fill:var(--sc-soft);font-family:${FONT.mono};font-size:8px}
.q-note{fill:var(--sc-paper-2);stroke:var(--sc-rule-solid);stroke-width:.8}
.q-note-text{fill:var(--sc-muted);font-size:10px;font-style:italic;font-family:${FONT.serif}}
.n-head{fill:var(--sc-ink);fill-opacity:.035;stroke:none}
.k-focal .n-head{fill:var(--sc-accent);fill-opacity:.08}
.n-rule{stroke:var(--sc-rule-solid);stroke-width:.8}
.n-field{fill:var(--sc-ink);font-size:10px}
.n-field-t{fill:var(--sc-muted);font-family:${FONT.mono};font-size:9px}
.n-key{font-family:${FONT.mono};font-size:7.5px;letter-spacing:.06em;fill:var(--sc-soft)}
.n-key-pk{fill:var(--sc-accent)}.n-key-fk{fill:var(--sc-link)}
.sh-start .n-box{fill:var(--sc-ink);stroke:none}
.sh-end .n-box{fill:var(--sc-paper);stroke:var(--sc-ink);stroke-width:1.2}
.n-dot{fill:var(--sc-ink)}
.n-status{stroke:var(--sc-paper);stroke-width:1.5}
.st-ok{fill:var(--sc-series-1)}.st-risk{fill:var(--sc-series-2)}.st-legacy{fill:var(--sc-series-5)}.st-retire{fill:var(--sc-series-4)}
.n-change{fill:var(--sc-accent);font-family:${FONT.mono};font-size:7.5px;letter-spacing:.12em}
.ch-added .n-box{stroke:var(--sc-accent);stroke-width:1.3}
.ch-removed{opacity:.55}.ch-removed .n-box{stroke-dasharray:4 3;stroke:var(--sc-soft)}.ch-removed .n-label{text-decoration:line-through}
.ch-removed .n-change{fill:var(--sc-soft)}
.ch-changed .n-box{stroke:var(--sc-accent);stroke-dasharray:6 2}
.sc-edge.ch-added .e-line{stroke:var(--sc-accent)}.sc-edge.ch-removed .e-line{stroke-dasharray:3 3}
.e-line.dashed{stroke-dasharray:4 3}
.ek-rel .e-line{stroke:var(--sc-muted);stroke-width:1}
.e-glyph.stroke{fill:none;stroke:var(--sc-muted);stroke-width:1}
.e-glyph.hollow{fill:var(--sc-paper);stroke:var(--sc-muted);stroke-width:1}
.e-glyph.filled{fill:var(--sc-muted);stroke:var(--sc-muted);stroke-width:1}
.lane-band{fill:var(--sc-ink);fill-opacity:.022}
.lane-band.alt{fill-opacity:0}
.lane-rule{stroke:var(--sc-rule);stroke-width:.8}
.lane-label{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.16em;text-transform:uppercase}
.loop-center{fill:var(--sc-ink);font-family:${FONT.serif};font-size:20px}
.nest-mask{fill:var(--sc-paper)}
.nest-box{fill:var(--sc-ink);fill-opacity:.025;stroke:var(--sc-rule-solid);stroke-width:.9}
.nest-d0 .nest-box{fill-opacity:.012}.nest-d2 .nest-box{fill-opacity:.04}.nest-d3 .nest-box{fill-opacity:.055}
.k-focal .nest-box{fill:var(--sc-accent-tint);fill-opacity:1;stroke:var(--sc-accent)}
.nest-label{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.14em;text-transform:uppercase}
.chip{fill:var(--sc-paper-2);stroke:var(--sc-rule);stroke-width:.8}
.chip-text{fill:var(--sc-ink);font-size:10px}
.k-focal .chip{fill:var(--sc-paper);stroke:var(--sc-accent);stroke-opacity:.4}
.venn-c{fill:var(--sc-muted);fill-opacity:.07;stroke:var(--sc-muted);stroke-width:1}
.vs-2 .venn-c{fill:var(--sc-series-2);stroke:var(--sc-series-2);fill-opacity:.09}
.vs-3 .venn-c{fill:var(--sc-series-1);stroke:var(--sc-series-1);fill-opacity:.09}
.venn.k-focal .venn-c{fill:var(--sc-accent);stroke:var(--sc-accent);fill-opacity:.09}
.venn-label{fill:var(--sc-ink);font-size:13px;font-weight:600}
.venn-ov{fill:var(--sc-muted);font-family:${FONT.serif};font-style:italic;font-size:13px}
.venn-ov.is-focal{fill:var(--sc-accent)}
.fb-spine{stroke-width:1.6}
.fb-tick{stroke:var(--sc-rule-solid);stroke-width:.8}
.fb-cat{fill:var(--sc-muted);font-family:${FONT.mono};font-size:9px;letter-spacing:.14em}
.fb-cat.is-focal{fill:var(--sc-accent)}
.fb-cause{fill:var(--sc-ink);font-size:10px}
.kb-col{fill:var(--sc-ink);fill-opacity:.025;stroke:var(--sc-rule);stroke-width:.8;rx:8}
.kb-col.is-over{stroke:var(--sc-accent);stroke-opacity:.6}
.kb-head{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8.5px;letter-spacing:.14em}
.kb-count{fill:var(--sc-soft);font-family:${FONT.mono};font-size:9px}
.kb-count.is-over{fill:var(--sc-accent)}
.kb-card{fill:var(--sc-ink);font-size:11px;font-weight:500}
.sm-act{fill:var(--sc-ink)}
.sm-activity.k-focal .sm-act{fill:var(--sc-accent)}
.sm-act-text{fill:var(--sc-paper);font-size:11px;font-weight:600}
.q-frame{fill:none;stroke:var(--sc-rule-solid);stroke-width:1}
.q-focal{fill:var(--sc-accent-tint)}
.q-title{fill:var(--sc-soft);font-family:${FONT.mono};font-size:8.5px;letter-spacing:.14em}
.quad.k-focal .q-title,.quad.k-focal .q-title-big{fill:var(--sc-accent)}
.q-title-big{fill:var(--sc-ink);font-family:${FONT.serif};font-size:19px}
.q-item{fill:var(--sc-muted);font-size:11px}
.q-dot{fill:var(--sc-muted)}
.q-pt.k-focal .q-dot{fill:var(--sc-accent)}
.q-pt-label{fill:var(--sc-ink);font-size:10.5px;font-weight:500}
.q-pt.k-focal .q-pt-label{fill:var(--sc-accent)}
.mx-col{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.08em}
.mx-row{fill:var(--sc-ink);font-size:11px;font-weight:500}
.mx-band{fill:var(--sc-ink);fill-opacity:.025}
.mx-g.fill{fill:var(--sc-ink)}.mx-g.ring{fill:none;stroke:var(--sc-ink);stroke-width:1}
.mx-g.dashed{stroke-dasharray:2 2}.mx-g.admin{fill:var(--sc-accent)}.mx-g.none{fill:var(--sc-soft)}
.mx-r.k-focal .mx-row{fill:var(--sc-accent)}
.tl-axis{stroke:var(--sc-ink);stroke-width:1.2}
.tl-stem{stroke:var(--sc-rule-solid);stroke-width:.8}
.tl-dot{fill:var(--sc-paper);stroke:var(--sc-ink);stroke-width:1.4}
.tl-ev.k-focal .tl-dot{fill:var(--sc-accent);stroke:var(--sc-accent)}
.tl-ev.k-focal .tl-label{fill:var(--sc-accent)}
.tl-label{font-size:11px}
.tl-when{fill:var(--sc-muted);font-family:${FONT.mono};font-size:9px;letter-spacing:.04em}
.tl-period{fill:var(--sc-ink);fill-opacity:.07}
.tl-period.is-focal{fill:var(--sc-accent);fill-opacity:.16}
.tl-period-text{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8px;letter-spacing:.08em}
.g-task{fill:var(--sc-ink);font-size:11px}
.g-bar{fill:var(--sc-muted);fill-opacity:.45}
.g-bar.is-focal{fill:var(--sc-accent);fill-opacity:1}
.g-bar.is-done{fill-opacity:.2}
.g-done{fill:var(--sc-muted);font-size:10px}
.g-mile{fill:var(--sc-ink)}
.k-focal .g-mile{fill:var(--sc-accent)}
.g-today{stroke:var(--sc-accent);stroke-width:1;stroke-dasharray:3 3}
.g-today-text{fill:var(--sc-accent);font-family:${FONT.mono};font-size:7.5px;letter-spacing:.14em}
.jr-band{fill:var(--sc-ink);fill-opacity:.025}.jr-band.alt{fill-opacity:0}
.jr-stage{fill:var(--sc-muted);font-family:${FONT.mono};font-size:8.5px;letter-spacing:.14em}
.jr-curve{stroke:var(--sc-ink);stroke-width:1.6}
.jr-dot{fill:var(--sc-paper);stroke:var(--sc-ink);stroke-width:1.4}
.jr-dot.is-pain,.jr-dot.is-focal{fill:var(--sc-accent);stroke:var(--sc-accent)}
.jr-step{fill:var(--sc-ink);font-size:10.5px;font-weight:500}
.jr-note{fill:var(--sc-muted);font-family:${FONT.serif};font-style:italic;font-size:11px;paint-order:stroke;stroke:var(--sc-paper);stroke-width:4px;stroke-linejoin:round}
.jr-note.is-pain{fill:var(--sc-accent)}
.ln{fill:none;stroke-width:1.6;stroke:var(--sc-muted)}
.ln.is-focal{stroke:var(--sc-accent);stroke-width:2.2}.ln.is-muted{stroke:var(--sc-soft);stroke-opacity:.55}
.ln-1{stroke:var(--sc-series-1)}.ln-2{stroke:var(--sc-series-2)}.ln-3{stroke:var(--sc-series-3)}.ln-4{stroke:var(--sc-series-4)}.ln-5{stroke:var(--sc-series-5)}
.ln-pt{fill:var(--sc-paper);stroke-width:1.4}
.ln-pt.is-focal{fill:var(--sc-accent)}
.ln-label{font-size:10.5px;font-weight:500;fill:var(--sc-muted)}
.is-muted-t{fill:var(--sc-soft)}
.ln-1-t{fill:var(--sc-series-1)}.ln-2-t{fill:var(--sc-series-2)}.ln-3-t{fill:var(--sc-series-3)}.ln-4-t{fill:var(--sc-series-4)}.ln-5-t{fill:var(--sc-series-5)}
.ln-area{fill:var(--sc-muted);fill-opacity:.08}.ln-area.is-focal{fill:var(--sc-accent);fill-opacity:.1}
.rg-area{fill:var(--sc-muted);fill-opacity:.18}.rg-area.is-focal{fill:var(--sc-accent);fill-opacity:.28}
.rg-line{fill:none;stroke:var(--sc-ink);stroke-width:1.1}.rg-line.is-focal{stroke:var(--sc-accent)}
.st-area{fill-opacity:.55;stroke:var(--sc-paper);stroke-width:1}
.st-area.is-focal{fill:var(--sc-accent);fill-opacity:.75}
.st-label{fill:var(--sc-ink-strong);font-size:10px;font-weight:600}
.is-focal-t{fill:var(--sc-accent)!important}
.sp-dot{fill:var(--sc-muted);fill-opacity:.55;stroke:var(--sc-paper);stroke-width:.8}
.sp-dot.is-bubble{fill-opacity:.25;stroke:var(--sc-muted);stroke-opacity:.7}
.sp-dot.is-focal{fill:var(--sc-accent);fill-opacity:.9;stroke:var(--sc-accent)}
.sp-label{fill:var(--sc-ink);font-size:10px;font-weight:500}
.rd-area{fill:var(--sc-muted);fill-opacity:.1}.rd-line{fill:none;stroke:var(--sc-muted);stroke-width:1.4}
.rd-area.is-focal{fill:var(--sc-accent);fill-opacity:.16}.rd-line.is-focal{stroke:var(--sc-accent);stroke-width:2}
.rd-area.is-muted{fill-opacity:.04}.rd-line.is-muted{stroke:var(--sc-soft)}
.rd-area.s-1,.rd-area.s-2,.rd-area.s-3,.rd-area.s-4,.rd-area.s-5{fill-opacity:.14}
.rd-line.s-1{stroke:var(--sc-series-1)}.rd-line.s-2{stroke:var(--sc-series-2)}.rd-line.s-3{stroke:var(--sc-series-3)}.rd-line.s-4{stroke:var(--sc-series-4)}.rd-line.s-5{stroke:var(--sc-series-5)}
.rd-pt{fill:var(--sc-paper);stroke:var(--sc-muted)}.rd-pt.is-focal{stroke:var(--sc-accent)}
.rd-key{fill:var(--sc-muted)}.rd-key.is-focal{fill:var(--sc-accent)}.rd-key.is-muted{fill:var(--sc-soft)}
.rd-ring{fill:none}
.pl-stem{stroke:var(--sc-muted);stroke-width:1.4}.pl-stem.is-focal{stroke:var(--sc-accent);stroke-width:2}
.pl-dot{fill:var(--sc-muted)}.pl-dot.is-focal{fill:var(--sc-accent)}
.wf-bar{fill:var(--sc-muted);fill-opacity:.4}
.wf-up{fill:var(--sc-series-1);fill-opacity:.75}.wf-down{fill:var(--sc-series-4);fill-opacity:.75}
.wf-total{fill:var(--sc-ink);fill-opacity:.82}
.wf-bar.is-focal{fill:var(--sc-accent);fill-opacity:1}
.wf-link{stroke:var(--sc-soft);stroke-width:.8;stroke-dasharray:2 2}
.tm-cell{fill:var(--sc-muted);fill-opacity:.16;stroke:var(--sc-paper);stroke-width:1}
.tm-cell.is-focal{fill:var(--sc-accent);fill-opacity:.85}
.tm-sub{fill:var(--sc-paper);fill-opacity:.55}
.tm-label{fill:var(--sc-ink);font-size:11px;font-weight:600}.tm-label.is-focal{fill:var(--sc-paper)}
.tm-val{fill:var(--sc-muted);font-family:${FONT.mono};font-size:9px}.tm-val.is-focal{fill:var(--sc-paper);fill-opacity:.85}
.tm-sub-label{fill:var(--sc-muted);font-size:9.5px}
.hm-cell.hm-pos{fill:var(--sc-accent)}.hm-cell.hm-neg{fill:var(--sc-series-4)}
.hm-val{fill:var(--sc-ink);font-family:${FONT.mono};font-size:8.5px}${ON_FILL.map((v) => `.hm-val.${v}{fill:var(--sc-on-${v})}`).join('')}
.db-line{stroke:var(--sc-rule-solid);stroke-width:2.4}.db-line.is-focal{stroke:var(--sc-accent);stroke-opacity:.45}
.db-a{fill:var(--sc-paper);stroke:var(--sc-muted);stroke-width:1.4}.db-b{fill:var(--sc-muted)}.db-b.is-focal{fill:var(--sc-accent)}
.mk-seg{fill-opacity:.7;stroke:var(--sc-paper)}
.mk-pct{fill:var(--sc-ink-strong);font-family:${FONT.mono};font-size:8.5px}
.wm-link{stroke:var(--sc-soft)!important;stroke-width:1!important}
.wm-dot{fill:var(--sc-paper);stroke:var(--sc-ink);stroke-width:1.4}.wm-dot.is-focal{fill:var(--sc-accent);stroke:var(--sc-accent)}
.wm-label{fill:var(--sc-ink);font-size:10.5px;font-weight:500;paint-order:stroke;stroke:var(--sc-paper);stroke-width:3px;stroke-linejoin:round}
.wm-label.is-anchor{font-weight:700;font-size:12px}
.wm-move{stroke:var(--sc-accent);stroke-width:1.2;stroke-dasharray:4 3;fill:none}.wm-move-head{fill:var(--sc-accent)}
.wm-ghost{fill:none;stroke:var(--sc-accent);stroke-dasharray:2 2}
.wm-inertia{stroke:var(--sc-ink);stroke-width:3}
.callout{fill:var(--sc-muted);font-family:${FONT.serif};font-style:italic;font-size:13px}
`;
