#!/usr/bin/env node
// Pull requests must not change release versions: the Release workflow bumps
// them after merge. Compares every versioned manifest against a base ref.
// Usage: node tools/check-version-unchanged.mjs [origin/main]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VERSIONED, get } from './manifests.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const base = process.argv[2] || 'origin/main';
const changed = [];
for (const [file, path] of VERSIONED) {
  const r = spawnSync('git', ['show', `${base}:${file}`], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.log(JSON.stringify({ ok: true, skipped: `${base} not available (${file})` }));
    process.exit(0);
  }
  const before = get(JSON.parse(r.stdout), path);
  const after = get(JSON.parse(readFileSync(join(ROOT, file), 'utf8')), path);
  if (before !== after) changed.push(`${file}: ${before} → ${after}`);
}
if (changed.length) {
  console.log(JSON.stringify({ ok: false, changed, fix: 'revert the version change; the Release workflow bumps versions after merge' }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, base }));
