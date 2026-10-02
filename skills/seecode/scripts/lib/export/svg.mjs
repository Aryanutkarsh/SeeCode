// Browser-free SVG export: build the standalone SVG straight from a SeeCode
// HTML page in Node. Works in sandboxes with no Chrome (e.g. Claude.ai).
// Output is the settled end frame (motion off), theme variables resolved,
// the diagram stylesheet inlined and, when the network allows, fonts embedded.
import { embedFonts } from './fonts.mjs';

const pick = (html, re) => (html.match(re) || [])[1];

export function svgFromHtml(html, { theme = 'light' } = {}) {
  const svgOpen = html.indexOf('<svg class="sc-svg');
  if (svgOpen < 0) throw new Error('no SeeCode diagram found in this HTML');
  let svg = html.slice(svgOpen, html.indexOf('</svg>', svgOpen) + 6);
  // theme variables: light is the plain :root block, dark the [data-theme="dark"] one
  const skin = pick(html, /<style>(:root\{[\s\S]*?)<\/style>/) || '';
  const light = pick(skin, /^:root\{([^}]*)\}/) || '';
  const dark = pick(skin, /:root\[data-theme="dark"\]\{([^}]*)\}/);
  const vars = theme === 'dark' && dark ? dark : light;
  const css = pick(html, /<style id="sc-diagram-css">([\s\S]*?)<\/style>/) || '';
  const fontsHref = (pick(html, /<link id="sc-fonts" rel="stylesheet" href="([^"]+)"/) || '').replace(/&amp;/g, '&');
  // a brand profile's fonts: extra Google Fonts stylesheets and self-hosted faces
  const brandHrefs = [...html.matchAll(/<link class="sc-brand-fonts" rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const brandFaces = pick(html, /<style id="sc-brand-faces">([\s\S]*?)<\/style>/) || '';
  const title = pick(html, /<h1 class="sc-title"[^>]*>([\s\S]*?)<\/h1>/) || 'Diagram';
  const titleId = pick(html, /<h1 class="sc-title" id="([^"]+)"/) || 'sc-title';
  const vb = pick(svg, /viewBox="([^"]+)"/).split(/\s+/).map(Number);
  svg = svg
    .replace(/^<svg class="sc-svg/, '<svg class="sc-svg sc-still')
    .replace(/ style="[^"]*"/, '') // motion vars + max-width
    .replace(/ data-sc-motion="[^"]*"/, '');
  const imports = [fontsHref, ...brandHrefs].filter(Boolean).map((h) => `@import url('${h.replace(/&/g, '&amp;')}');`).join('');
  const head = `<title id="${titleId}">${title}</title><style>${imports}${brandFaces.replace(/&/g, '&amp;').replace(/</g, '&lt;')}:root{${vars}}${css.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>`;
  svg = svg.replace(/^(<svg[^>]*>)/, (m) => `${m.replace('<svg ', `<svg width="${vb[2]}" height="${vb[3]}" `)}${head}`);
  return svg;
}

export async function exportSvg(html, opts = {}) {
  const svg = svgFromHtml(html, opts);
  const embedded = await embedFonts(svg);
  return { svg: embedded.svg, warning: embedded.ok ? null : `fonts not embedded (${embedded.error}); offline viewers fall back to system fonts` };
}
