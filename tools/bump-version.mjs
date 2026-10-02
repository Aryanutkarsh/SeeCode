#!/usr/bin/env node
// Bump the version everywhere at once: `npm run bump [patch|minor|major|x.y.z]`.
// Plugin hosts (Claude Code, Codex, Copilot, Factory) update installs when this changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSIONED, get, set } from './manifests.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const cur = read('package.json').version;
const arg = process.argv[2] || 'patch';
const [ma, mi, pa] = cur.split('.').map(Number);
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : arg === 'major' ? `${ma + 1}.0.0` : arg === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
for (const [file, path] of VERSIONED) {
  const j = read(file);
  set(j, path, next);
  writeFileSync(join(ROOT, file), `${JSON.stringify(j, null, 2)}\n`);
}
const skill = join(ROOT, 'skills/seecode/SKILL.md');
writeFileSync(skill, readFileSync(skill, 'utf8').replace(/version: "[^"]+"/, `version: "${next}"`));
console.log(JSON.stringify({ ok: true, from: cur, to: next }));
