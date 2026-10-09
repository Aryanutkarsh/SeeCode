// A folder of specs (e.g. from `SC import <file> --all`) is handled as one
// set: render writes every diagram's HTML next to its spec plus index.html, a
// contact sheet linking them; export writes each diagram's files next to its
// HTML; --zip packs the folder for sharing.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { renderSpec, outPathFor, writeAtomic, summarize } from './render.mjs';
import { FONTS_HREF, skinCss } from './tokens.mjs';
import * as config from './config/config.mjs';

export const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Spec files in source order (NN- prefixes sort naturally); JSON files that
// are not specs (data files) are skipped.
function specsIn(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).flatMap((f) => {
    try {
      const spec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      return spec && typeof spec.type === 'string' ? [{ file: f, path: join(dir, f), spec }] : [];
    } catch {
      return [{ file: f, path: join(dir, f), error: 'not valid JSON' }];
    }
  });
}

export function renderFolder(dir, { motion } = {}) {
  const settings = config.status(dir).settings;
  const items = specsIn(dir);
  if (!items.length) return { ok: false, error: `no spec files (*.json with a "type") in ${dir}`, fix: 'import a file with --all, or put specs in the folder' };
  const diagrams = items.map((it) => {
    if (it.error) return { spec: it.file, ok: false, error: it.error };
    const spec = motion ? { ...it.spec, motion } : it.spec;
    const r = renderSpec(spec, { specPath: it.path, settings });
    if (!r.ok) return { spec: it.file, ...summarize(r) };
    const out = outPathFor(spec, it.path, settings);
    writeAtomic(out, r.html);
    const s = summarize(r, out);
    return { spec: it.file, ok: true, out, title: spec.title || s.type, type: s.type, ...(s.problems ? { problems: s.problems } : {}) };
  });
  const done = diagrams.filter((d) => d.ok);
  const index = join(dir, 'index.html');
  writeAtomic(index, indexHtml(basename(dir), done.map((d) => ({ href: basename(d.out), title: d.title, type: d.type }))));
  return {
    ok: done.length === diagrams.length,
    folder: dir,
    count: diagrams.length,
    rendered: done.length,
    index,
    diagrams,
    next: `open ${index} to browse them all; SC export ${dir} --for <destination> for files`,
  };
}

export function indexHtml(name, cards) {
  const title = name.replace(/[-_]+/g, ' ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link rel="stylesheet" href="${FONTS_HREF.replace(/&/g, '&amp;')}"><style>${skinCss()}
*{box-sizing:border-box;margin:0}body{background:var(--sc-paper);color:var(--sc-ink);font-family:var(--sc-font-sans);padding:48px 24px}
main{max-width:1240px;margin:0 auto}h1{font-family:var(--sc-font-serif);font-weight:400;font-size:36px}p.lead{color:var(--sc-muted);margin:8px 0 24px}
ol{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;counter-reset:d}
li{counter-increment:d}a.card{display:block;text-decoration:none;color:inherit;border:1px solid var(--sc-rule);border-radius:10px;overflow:hidden;background:var(--sc-paper)}
a.card:hover,a.card:focus-visible{border-color:var(--sc-accent);outline:none}
iframe{width:200%;height:420px;border:0;transform:scale(.5);transform-origin:0 0;margin-bottom:-210px;pointer-events:none;display:block}
.meta{display:flex;gap:10px;align-items:baseline;padding:10px 12px;border-top:1px solid var(--sc-rule)}.meta::before{content:counter(d,decimal-leading-zero);font:500 11px var(--sc-font-mono);color:var(--sc-soft)}
.meta b{font-weight:600;font-size:13px;flex:1}.meta code{font:11px var(--sc-font-mono);color:var(--sc-soft)}
@media (max-width:640px){body{padding:28px 16px}}</style></head><body><main><h1>${esc(title)}</h1>
<p class="lead">${cards.length} diagram${cards.length === 1 ? '' : 's'}, in source order. Open one to explore it: hover to trace, click to focus, ◀ ▶ to step.</p>
<ol>${cards.map((c) => `<li><a class="card" href="${esc(encodeURI(c.href))}"><iframe src="${esc(encodeURI(c.href))}?motion=still&amp;embed=1&amp;theme=light" loading="lazy" tabindex="-1" title="${esc(c.title)}"></iframe><div class="meta"><b>${esc(c.title)}</b><code>${esc(c.type || '')}</code></div></a></li>`).join('')}</ol>
</main></body></html>
`;
}

// Every rendered diagram's HTML in the folder (not index.html).
export function diagramsIn(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html').sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).filter((f) => readFileSync(join(dir, f), 'utf8').includes('class="sc-svg')).map((f) => join(dir, f));
}

export async function exportFolder(dir, flags, exportDiagram) {
  const htmls = diagramsIn(dir);
  if (!htmls.length) return { ok: false, error: `no rendered diagrams in ${dir}`, fix: `run SC render ${dir} first` };
  const diagrams = [];
  for (const h of htmls) {
    const r = await exportDiagram(h, flags);
    diagrams.push({ html: basename(h), ok: r.ok, files: (r.files || []).map((f) => basename(f.path)), ...(r.warnings ? { warnings: r.warnings } : {}), ...(r.error ? { error: r.error } : {}) });
  }
  const ok = diagrams.every((d) => d.ok);
  const zip = flags.zip ? zipFolder(dir) : null;
  return { ok, folder: dir, count: diagrams.length, diagrams, ...(zip ? { zip } : {}) };
}

// ---- zip (stored + deflate, no dependencies) -------------------------------
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// Packs the folder's files (not subfolders) into <folder>.zip next to it.
export function zipFolder(dir) {
  const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()).sort();
  const root = basename(dir);
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const data = readFileSync(join(dir, f));
    const comp = deflateRawSync(data, { level: 9 });
    const name = Buffer.from(`${root}/${f}`);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(0, 10); head.writeUInt16LE(0x21, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
    locals.push(head, name, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(0x0314, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE((0o100644 << 16) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    centrals.push(cen, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const out = `${dir.replace(/[/\\]+$/, '')}.zip`;
  writeFileSync(out, Buffer.concat([...locals, cd, end]));
  return out;
}
