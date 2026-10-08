import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importFile, detect } from '../skills/seecode/scripts/lib/importers/import.mjs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { parseDrawio, parseExcalidraw, MAX_CELLS } from '../skills/seecode/scripts/lib/importers/canvas.mjs';

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

const cell = (id, attrs, geo = 'x="0" y="0" width="80" height="40"') => `<mxCell id="${id}" ${attrs}><mxGeometry ${geo} as="geometry"/></mxCell>`;
const board = (cells) => `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;

test('draw.io: a cyclic parent chain imports instead of hanging', () => {
  const m = parseDrawio(board([cell('a', 'value="A" vertex="1" parent="b"'), cell('b', 'value="B" vertex="1" parent="a"')]));
  assert.equal(m.error, undefined);
  assert.equal(m.nodes.length, 2);
});

test('draw.io: repeated ids, bad geometry and oversized pages are clear errors', () => {
  assert.match(parseDrawio(board([cell('a', 'value="A" vertex="1" parent="1"'), cell('a', 'value="B" vertex="1" parent="1"')])).error, /repeats cell id "a"/);
  assert.match(parseDrawio(board([cell('a', 'value="A" vertex="1" parent="1"', 'x="1e400" y="0" width="80" height="40"')])).error, /geometry/);
  const many = Array.from({ length: MAX_CELLS + 1 }, (_, i) => `<mxCell id="c${i}" parent="1"/>`);
  assert.match(parseDrawio(board(many)).error, /limit/);
});

test('draw.io: edge direction follows the arrowheads', () => {
  const m = parseDrawio(board([
    cell('a', 'value="A" vertex="1" parent="1"'), cell('b', 'value="B" vertex="1" parent="1"', 'x="200" y="0" width="80" height="40"'),
    '<mxCell id="e1" edge="1" source="a" target="b" style="startArrow=classic;endArrow=none;" parent="1"/>',
    '<mxCell id="e2" edge="1" source="a" target="b" style="endArrow=none;" parent="1"/>',
  ]));
  assert.deepEqual(m.edges.map((e) => [e.from, e.to, e.kind]), [['b', 'a', undefined], ['a', 'b', 'muted']]);
});

test('excalidraw: repeated element ids are rejected; containerId text still labels a shape', () => {
  const rect = (id, x) => ({ id, type: 'rectangle', x, y: 0, width: 100, height: 50 });
  assert.match(parseExcalidraw({ elements: [rect('r', 0), rect('r', 200)] }).error, /repeats element id "r"/);
  const m = parseExcalidraw({ elements: [rect('r', 0), { id: 't', type: 'text', text: 'Hello', containerId: 'r', x: 0, y: 0, width: 40, height: 20 }] });
  assert.deepEqual(m.nodes.map((n) => n.label), ['Hello']);
});
