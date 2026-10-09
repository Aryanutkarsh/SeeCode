// Exported SVGs carry their own stylesheet. Scoped to the SVG's id, two
// diagrams pasted into one page (light and dark, or two brands) keep their
// own colours, and their rules never touch the host page.

// Rewrites every rule to apply under #id: `:root` and the `.sc-svg` root
// become `#id` itself; other selectors become descendants. @media blocks are
// scoped inside; @keyframes and @font-face are left as they are. Written
// without imports or outer references: the viewer embeds its source.
export function scopeCss(css, id) {
  const sel = (list) => list.split(',').map((s) => {
    const x = s.trim();
    if (!x) return x;
    if (x.startsWith(':root')) return `#${id}${x.slice(5)}`;
    if (x.startsWith('.sc-svg')) return `#${id}${x}`;
    return `#${id} ${x}`;
  }).join(',');
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) { out += css.slice(i); break; }
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const head = css.slice(i, open);
    const body = css.slice(open + 1, j - 1);
    const at = head.trim();
    if (/^@(media|supports|container)\b/.test(at)) out += `${head}{${scopeCss(body, id)}}`;
    else if (at.startsWith('@')) out += `${head}{${body}}`;
    else out += `${head.slice(0, head.length - head.trimStart().length)}${sel(at)}{${body}}`;
    i = j;
  }
  return out;
}

// Short stable hash (FNV-1a, base 36) so two diagrams with the same title
// still get different ids.
export function shortHash(str) {
  let h = 0x811c9dc5;
  for (let k = 0; k < str.length; k++) {
    h ^= str.charCodeAt(k);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).slice(0, 6);
}
