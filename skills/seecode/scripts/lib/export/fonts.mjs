// Replace font @imports with inline @font-face rules, so the SVG renders the
// same in PDFs, Word, Figma and GitHub (which block external font requests).
// Google Fonts are subset to the characters actually drawn; a brand's own
// @font-face files (https) are inlined whole.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const MAX_FONT_BYTES = 1_500_000;

// Every `family=Name:axes` in the Google Fonts stylesheets the SVG imports.
export function googleFamilies(svg) {
  const fams = [];
  for (const m of svg.matchAll(/@import url\('(https:\/\/fonts\.googleapis\.com\/css2\?[^']+)'\);/g)) {
    const url = new URL(m[1].replace(/&amp;/g, '&'));
    for (const f of url.searchParams.getAll('family')) fams.push(f);
  }
  return [...new Set(fams)];
}

const toData = async (src) => {
  const r = await fetch(src);
  if (!r.ok) throw new Error(`HTTP ${r.status} for a font file`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_FONT_BYTES) throw new Error('font file too large to embed');
  const type = /\.woff2(\?|$)/.test(src) ? 'woff2' : /\.woff(\?|$)/.test(src) ? 'woff' : /\.ttf(\?|$)/.test(src) ? 'truetype' : /\.otf(\?|$)/.test(src) ? 'opentype' : 'woff2';
  return `data:font/${type === 'truetype' ? 'ttf' : type === 'opentype' ? 'otf' : type};base64,${buf.toString('base64')}`;
};

export async function embedFonts(svg) {
  try {
    const chars = new Set();
    for (const m of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) for (const ch of m[1].replace(/&[a-z#0-9]+;/gi, (e) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' }[e] || ' '))) chars.add(ch);
    // uppercase variants too (labels use text-transform)
    for (const ch of [...chars]) chars.add(ch.toUpperCase());
    const text = [...chars].join('') + ' 0123456789';
    const faces = [];
    // only families that lead a font stack are drawn; fallbacks replaced by a brand font are skipped
    const leads = new Set([...svg.matchAll(/--sc-font-(?:serif|sans|mono):\s*'([^']+)'/g)].map((m) => m[1].toLowerCase()));
    if (/Kalam/.test(svg)) leads.add('kalam');
    const used = googleFamilies(svg).filter((f) => !leads.size || leads.has(f.split(':')[0].replace(/\+/g, ' ').toLowerCase()));
    for (const fam of used) {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+').replace(/%3A/gi, ':').replace(/%40/g, '@').replace(/%3B/gi, ';').replace(/%2C/gi, ',')}&text=${encodeURIComponent(text)}&display=swap`;
      const css = await (await fetch(url, { headers: { 'user-agent': UA } })).text();
      for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
        const src = (block.match(/url\(([^)]+)\)/) || [])[1];
        if (!src) continue;
        faces.push(block.replace(/src:[^;]+;/, `src:url(${await toData(src)}) format('woff2');`));
      }
    }
    if (!faces.length) return { ok: false, svg, error: 'no font faces returned' };
    let out = svg.replace(/@import url\('https:\/\/fonts\.googleapis\.com\/[^']*'\);/g, '');
    out = out.replace(/(<style>)/, `$1${faces.join('')}`);
    // a brand's self-hosted faces: inline each file so the SVG works offline
    const own = [...out.matchAll(/url\("(https:\/\/[^"]+)"\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:')).slice(0, 8);
    let missed = 0;
    for (const u of own) {
      try { out = out.split(`url("${u}")`).join(`url(${await toData(u)})`); } catch { missed++; }
    }
    return { ok: true, svg: out, ...(missed ? { warning: `${missed} brand font file(s) could not be embedded and load from the web` } : {}) };
  } catch (e) {
    return { ok: false, svg, error: String(e.message || e).split('\n')[0] };
  }
}
