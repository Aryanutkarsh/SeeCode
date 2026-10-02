import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importFile, detect } from '../skills/seecode/scripts/lib/importers/import.mjs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'sc-import-'));

const EXPECT = {
  'flow.mmd': ['flowchart', 7, 6], 'seq.mmd': ['sequence', 3], 'er.mmd': ['er', 3, 2], 'class.mmd': ['uml-class', 4, 3],
  'state.mmd': ['state', 5, 5], 'gantt.mmd': ['gantt', 2], 'pie.mmd': ['bar'], 'mind.mmd': ['tree'], 'journey.mmd': ['journey'],
  'timeline.mmd': ['timeline', 3], 'quad.mmd': ['quadrant'], 'sankey.mmd': ['sankey'], 'xy.mmd': ['bar'], 'c4.mmd': ['architecture', 4, 3],
  'arch.mmd': ['architecture', 2, 1], 'deps.dot': ['dependency', 5, 4], 'seq.puml': ['sequence', 3], 'class.puml': ['uml-class', 2, 1],
  'comp.puml': ['deployment', 3, 2], 'act.puml': ['flowchart', 6], 'net.d2': ['architecture', 4, 3], 'tables.d2': ['db-schema', 2, 1],
  'board.drawio': ['architecture', 4, 3], 'sketch.excalidraw': ['flowchart', 2, 1], 'model.dsl': ['architecture', 4, 3],
  'refund.bpmn': ['swimlane', 5, 4], 'schema.sql': ['db-schema', 3, 2], 'schema.prisma': ['db-schema', 2, 1], 'schema.dbml': ['db-schema', 2, 1],
  'api.yaml': ['architecture', 4, 3], 'sales.csv': ['bar'], 'flows.csv': ['sankey'], 'trend.csv': ['line'], 'readme.md': ['flowchart', 3, 2],
};

for (const f of readdirSync(FIX)) {
  test(`import ${f}`, () => {
    const [type, count, edges] = EXPECT[f] || [];
    const r = importFile(join(FIX, f), { out: join(out, `${f.replace(/\W/g, '_')}.json`) });
    assert.equal(r.ok, true, JSON.stringify(r));
    if (type) assert.equal(r.type, type);
    if (count !== undefined) assert.equal(r.count, count);
    if (edges !== undefined) assert.equal(r.edges, edges);
    const spec = JSON.parse(readFileSync(r.draft, 'utf8'));
    const rr = renderSpec(spec, { specPath: r.draft });
    assert.equal(rr.ok, true, JSON.stringify(rr.problems));
    const bad = (rr.result.problems || []).filter((p) => p.code.startsWith('E_'));
    assert.deepEqual(bad, []);
  });
}

test('format detection sniffs content when the extension is generic', () => {
  assert.equal(detect('x.txt', 'digraph { a -> b }'), 'dot');
  assert.equal(detect('x.txt', '@startuml\nA -> B\n@enduml'), 'plantuml');
  assert.equal(detect('x.txt', 'sequenceDiagram\nA->>B: hi'), 'mermaid');
  assert.equal(detect('x.json', '{"openapi":"3.0.0","paths":{}}'), 'openapi');
  assert.equal(detect('x.xml', '<mxfile><diagram/></mxfile>'), 'drawio');
});

test('labels from imported files are data: tags stripped, length capped', () => {
  const r = importFile(join(FIX, 'board.drawio'), { out: join(out, 'b.json') });
  const spec = JSON.parse(readFileSync(r.draft, 'utf8'));
  assert.ok(spec.nodes.every((n) => !/[<>]/.test(n.label) && n.label.length <= 40));
});
