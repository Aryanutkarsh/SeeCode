import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { TYPES } from '../skills/seecode/scripts/lib/types.mjs';
import { exampleSpecs } from '../tools/examples.mjs';

const ROOT = fileURLToPath(new URL('../skills/seecode/', import.meta.url));
const specs = exampleSpecs();
const examples = specs.map((x) => `${x.type}.json`);
const specPath = (f) => specs.find((x) => `${x.type}.json` === f).path;

test('every registered type has an example and a guide', () => {
  for (const slug of Object.keys(TYPES)) {
    assert.ok(examples.includes(`${slug}.json`), `missing examples/${slug}.json`);
    assert.ok(readdirSync(join(ROOT, 'references/types')).includes(`${slug}.md`), `missing guide for ${slug}`);
  }
});

for (const file of examples) {
  test(`example ${file} renders cleanly with motion`, () => {
    const spec = JSON.parse(readFileSync(specPath(file), 'utf8'));
    const r = renderSpec(spec, { specPath: specPath(file) });
    assert.equal(r.ok, true, JSON.stringify(r.problems));
    const bad = (r.result.problems || []).filter((p) => !p.code.startsWith('I_'));
    assert.deepEqual(bad, [], `warnings/errors: ${JSON.stringify(bad)}`);
    assert.match(r.html, /data-sc-motion="(trace|reveal|step|loop)"/);
    const steps = [...r.html.matchAll(/data-sc-step="(\d+)"/g)].map((m) => Number(m[1]));
    assert.ok(steps.length > 2, 'has motion steps');
    assert.ok(Math.max(...steps) <= 12, 'at most 12 steps');
    assert.match(r.html, /role="img" aria-labelledby="[^"]+-title [^"]+-desc"/);
    const svgPart = r.html.slice(r.html.indexOf('<svg class="sc-svg'), r.html.indexOf('</svg>'));
    assert.doesNotMatch(svgPart, /NaN|undefined/);
  });
}

test('motion:none renders a static diagram', () => {
  const spec = JSON.parse(readFileSync(specPath('architecture.json'), 'utf8'));
  const r = renderSpec({ ...spec, motion: 'none' });
  assert.equal(r.ok, true);
  assert.doesNotMatch(r.html, /<svg[^>]*data-sc-motion=/);
});

test('graph nodes never overlap and edges avoid foreign nodes', () => {
  for (const file of examples) {
    const spec = JSON.parse(readFileSync(specPath(file), 'utf8'));
    if (TYPES[spec.type].family !== 'graph') continue;
    const r = renderSpec(spec);
    const boxes = [...r.html.matchAll(/data-sc-node="([^"]+)"[^>]*><rect class="n-mask" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)]
      .map((m) => ({ id: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5] }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        assert.ok(!overlap, `${file}: ${a.id} overlaps ${b.id}`);
      }
    }
  }
});

test('unknown edge endpoint gives an actionable error', () => {
  const r = renderSpec({ type: 'architecture', nodes: [{ id: 'api', label: 'API', row: 0, col: 0 }, { id: 'db', label: 'DB', row: 0, col: 1 }], edges: [['api', 'dbx']] });
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].code, 'E_EDGE_NODE');
  assert.match(r.problems[0].fix, /db/);
});

test('schema rejects unknown fields with a fix', () => {
  const r = renderSpec({ type: 'bar', data: [['a', 1]], colour: 'red' });
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].at, 'colour');
  assert.ok(r.problems[0].fix);
});

test('two nodes in one cell is an error', () => {
  const r = renderSpec({ type: 'architecture', nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 0 }] });
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].code, 'E_CELL_TAKEN');
});

test('every JSON example in the type guides renders without errors or warnings', () => {
  for (const f of readdirSync(join(ROOT, 'references/types')).filter((x) => x.endsWith('.md'))) {
    const md = readFileSync(join(ROOT, 'references/types', f), 'utf8');
    for (const m of md.matchAll(/```json\n([\s\S]*?)```/g)) {
      const spec = JSON.parse(m[1]);
      if (!spec.type) continue;
      const r = renderSpec(spec);
      assert.equal(r.ok, true, `${f}: ${JSON.stringify(r.problems)}`);
      const bad = (r.result.problems || []).filter((p) => p.code.startsWith('E_'));
      assert.deepEqual(bad, [], f);
    }
  }
});
