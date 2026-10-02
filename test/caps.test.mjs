import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../skills/seecode/', import.meta.url));

test('SKILL.md stays ≤ 4 KB (loaded on every use)', () => {
  assert.ok(statSync(join(ROOT, 'SKILL.md')).size <= 4096);
});

test('each type guide stays ≤ 1.5 KB (index ≤ 2.5 KB)', () => {
  for (const f of readdirSync(join(ROOT, 'references/types'))) {
    const size = statSync(join(ROOT, 'references/types', f)).size;
    const cap = f === 'INDEX.md' ? 2560 : 1536;
    assert.ok(size <= cap, `${f} is ${size} bytes (cap ${cap})`);
  }
});

test('every reference linked from SKILL.md exists', () => {
  const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  for (const m of skill.matchAll(/`(references\/[a-z-]+\.md)`/g)) {
    assert.doesNotThrow(() => statSync(join(ROOT, m[1])), `${m[1]} missing`);
  }
});

test('agent-side token budget per diagram stays small', async () => {
  const { budget } = await import('../tools/budget.mjs');
  const b = budget();
  assert.ok(b.perDiagram.max < 6000, `heaviest diagram costs ~${b.perDiagram.max} tokens`);
  assert.ok(b.perDiagram.avg < 3500, `average ~${b.perDiagram.avg} tokens`);
});
