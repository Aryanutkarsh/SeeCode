// Text width estimation without a browser: measured advances (in em) for
// IBM Plex Sans / Plex Mono; wide (CJK, full-width) characters always cost
// 1em and combining marks cost nothing.

// IBM Plex Sans advance widths (per mille of the font size) for printable
// ASCII (32–126), measured in Chrome at weights 400 and 600. Other scripts
// fall back to the shape heuristics below.
const PLEX_400 = [236,284,419,713,598,927,694,242,335,335,450,600,272,399,272,383,600,600,600,600,600,600,600,600,600,600,292,292,600,600,600,477,881,641,653,621,671,583,542,695,707,400,510,634,501,812,707,708,606,708,640,568,572,678,614,891,613,593,580,317,383,317,600,565,600,534,580,497,580,549,319,528,568,250,250,527,272,873,568,560,580,580,367,480,351,568,492,768,507,499,464,343,314,343,600];
const PLEX_600 = [236,309,471,656,600,960,713,260,337,337,556,600,299,402,299,437,600,600,600,600,600,600,600,600,600,600,319,319,600,600,600,493,882,672,663,642,689,600,551,712,719,423,545,678,521,817,719,712,641,712,664,591,580,689,642,949,655,632,599,329,437,329,600,559,600,559,600,508,600,558,346,545,588,275,275,562,294,888,588,563,600,600,393,491,374,588,524,819,544,521,502,363,376,363,600];
// Kerning and a fallback font (Noto Sans, system-ui when web fonts are
// blocked) can run a little wider than the measured advances.
const MARGIN = 1.03;
const NARROW = new Set([...`il.,:;'|!\`ijlrtf()[]{}`]);
const WIDE_UPPER = new Set([...'MWQOGDCH@%&']);

function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

function isMark(cp) {
  return (cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x20d0 && cp <= 0x20ff) || cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f);
}

export function advance(ch, mono, bold = false) {
  const cp = ch.codePointAt(0);
  if (isMark(cp)) return 0;
  if (isWide(cp)) return 1;
  if (mono) return 0.6;
  if (cp >= 32 && cp <= 126) return ((bold ? PLEX_600 : PLEX_400)[cp - 32] / 1000) * MARGIN;
  const k = bold ? 1.04 : 1;
  return heuristic(ch) * k;
}

function heuristic(ch) {
  if (ch === ' ') return 0.28;
  if (NARROW.has(ch)) return 0.3;
  if (WIDE_UPPER.has(ch)) return 0.74;
  if (ch >= 'A' && ch <= 'Z') return 0.64;
  if (ch >= '0' && ch <= '9') return 0.58;
  if (ch === 'm' || ch === 'w') return 0.84;
  return 0.54;
}

// Widths are estimated for IBM Plex. A brand typeface may run wider, so a
// render with brand fonts measures with a safety margin (see renderSpec).
let widthScale = 1;
export function setWidthScale(k) { const prev = widthScale; widthScale = k; return prev; }

// opts: { size, mono, tracking (em), upper, weight }
export function textWidth(str, { size = 12, mono = false, tracking = 0, upper = false, weight = 400 } = {}) {
  const s = upper ? String(str).toUpperCase() : String(str);
  let em = 0;
  let n = 0;
  const bold = !mono && weight >= 600;
  for (const ch of s) {
    em += advance(ch, mono, bold);
    n++;
  }
  return (em * size + Math.max(0, n - 1) * tracking * size) * widthScale;
}

export const snap = (v, g = 4) => Math.round(v / g) * g;
export const ceil4 = (v) => Math.ceil(v / 4) * 4;

// CJK line-breaking: a break may fall between any two wide characters, but
// closing punctuation never starts a line and opening punctuation never ends one.
const NO_START = new Set([...'、。，．：；！？）」』】〕〉》｝］〙〗’”…‥ー々ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ']);
const NO_END = new Set([...'（「『【〔〈《｛［〘〖‘“']);

// Split into units that may not be broken inside: Latin words (with the
// space before them) and single wide characters (glued to punctuation).
function units(str) {
  const out = [];
  for (const m of String(str).matchAll(/(\s*)(\S+)/g)) {
    const space = m[1].length > 0 && out.length > 0;
    let word = '';
    let first = true;
    const flush = (glue) => {
      if (!word) return;
      out.push({ text: word, space: first ? space : false, glue });
      word = '';
      first = false;
    };
    for (const ch of m[2]) {
      const cp = ch.codePointAt(0);
      if (NO_START.has(ch) && (word || out.length)) {
        if (word) word += ch;
        else out[out.length - 1].text += ch;
        continue;
      }
      if (isWide(cp) || NO_END.has(ch)) {
        if (word && !NO_END.has([...word].pop())) flush();
        word += ch;
        if (!NO_END.has(ch)) flush();
      } else {
        if (word && isWide([...word].pop().codePointAt(0))) flush();
        word += ch;
      }
    }
    flush();
  }
  return out;
}

// Greedy wrap to maxWidth; returns lines. Breaks at spaces, and between CJK
// characters, which have no spaces to break at.
export function wrap(str, maxWidth, opts) {
  const lines = [];
  let cur = '';
  for (const u of units(str)) {
    const next = cur ? `${cur}${u.space ? ' ' : ''}${u.text}` : u.text;
    if (cur && textWidth(next, opts) > maxWidth) {
      lines.push(cur);
      cur = u.text;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
