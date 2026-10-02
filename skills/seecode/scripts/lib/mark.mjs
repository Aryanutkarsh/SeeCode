// The SeeCode watermark, drawn inside every diagram's SVG (bottom right) so
// HTML, SVG, PNG, GIF and MP4 all carry it. The tan symbol keeps its colour;
// the lettering is a mask painted with the diagram's ink colour, so it stays
// legible on light, dark and brand backgrounds without per-theme artwork.
// On by default: a spec's `"watermark": false` or the `watermark` setting turns it off.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ASSETS = new URL('../../assets/', import.meta.url);
let cache = null;
function assets() {
  if (!cache) {
    const b64 = (f) => readFileSync(fileURLToPath(new URL(f, ASSETS))).toString('base64');
    cache = { symbol: `data:image/png;base64,${b64('mark-symbol.png')}`, word: `data:image/png;base64,${b64('mark-word.png')}` };
  }
  return cache;
}

export const FAVICON = () => `data:image/png;base64,${readFileSync(fileURLToPath(new URL('favicon.png', ASSETS))).toString('base64')}`;

// Geometry in diagram units: 16-unit symbol, lettering at 62% of that height.
const H = 16;
const SYMBOL_W = H * (97 / 96);
const WORD_H = 9.6;
const WORD_W = WORD_H * (350 / 64);
const GAP = 4;
export const MARK = { height: H, width: SYMBOL_W + GAP + WORD_W, strip: H + 12 };

export function watermarkOn(spec, settings = {}) {
  const v = spec.watermark !== undefined ? spec.watermark : settings.watermark;
  return !(v === false || v === 'false' || v === 'off');
}

// Returns the SVG for the mark, anchored to the bottom-right corner of the
// (already extended) viewBox [vx, vy, vw, vh].
export function watermarkSvg([vx, vy, vw, vh], slug) {
  const { symbol, word } = assets();
  const x = vx + vw - 12 - MARK.width;
  const y = vy + vh - 8 - H;
  const wx = SYMBOL_W + GAP, wy = (H - WORD_H) / 2 + 0.6;
  const id = `${slug}-mark`;
  const img = (href, ax, ay, w, h) => `<image href="${href}" xlink:href="${href}" x="${ax}" y="${ay}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="none"/>`;
  return `<g class="sc-mark" aria-hidden="true" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">`
    + `<mask id="${id}" maskUnits="userSpaceOnUse" x="${wx.toFixed(2)}" y="${wy.toFixed(2)}" width="${WORD_W.toFixed(2)}" height="${WORD_H.toFixed(2)}">${img(word, wx.toFixed(2), wy.toFixed(2), WORD_W, WORD_H)}</mask>`
    + img(symbol, 0, 0, SYMBOL_W, H)
    + `<rect class="sc-mark-word" x="${wx.toFixed(2)}" y="${wy.toFixed(2)}" width="${WORD_W.toFixed(2)}" height="${WORD_H.toFixed(2)}" mask="url(#${id})"/>`
    + '</g>';
}
