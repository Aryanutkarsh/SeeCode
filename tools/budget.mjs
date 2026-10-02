#!/usr/bin/env node
// Estimate the agent-side token cost of making each example diagram:
// SKILL.md + type guide (read) + spec (written) + render output (read).
// ~3.6 chars per token for mixed English/JSON is a conservative estimate.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSpec, summarize, compactJson } from '../skills/seecode/scripts/lib/render.mjs';
import { ALIASES } from '../skills/seecode/scripts/lib/types.mjs';
import { exampleSpecs } from './examples.mjs';

const ROOT = fileURLToPath(new URL('../skills/seecode/', import.meta.url));
const tok = (chars) => Math.ceil(chars / 3.6);
const size = (p) => { try { return statSync(p).size; } catch { return 0; } };

export function budget() {
  const skill = size(join(ROOT, 'SKILL.md'));
  const rows = [];
  for (const ex of exampleSpecs()) {
    const f = `${ex.type}.json`;
    const spec = JSON.parse(readFileSync(ex.path, 'utf8'));
    const base = ALIASES[spec.type]?.[0] || spec.type;
    const guide = size(join(ROOT, 'references/types', `${spec.type}.md`)) || size(join(ROOT, 'references/types', `${base}.md`));
    const written = compactJson(spec).length;
    const r = renderSpec(spec, { specPath: ex.path });
    const out = JSON.stringify(summarize(r, `/path/to/${f.replace('.json', '.html')}`)).length;
    const read = skill + guide + out;
    rows.push({ type: spec.type, readTokens: tok(read), writeTokens: tok(written), total: tok(read + written) });
  }
  rows.sort((a, b) => b.total - a.total);
  const avg = Math.round(rows.reduce((s, r) => s + r.total, 0) / rows.length);
  return { ok: true, perDiagram: { avg, max: rows[0].total, min: rows[rows.length - 1].total }, heaviest: rows.slice(0, 5), note: 'agent-side tokens for one diagram on the first try (excludes conversation and repo reading)' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(budget(), null, 1));
