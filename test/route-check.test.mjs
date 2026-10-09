// Connector geometry checks run on finished routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRoutes } from '../skills/seecode/scripts/lib/render/graph/verify.mjs';

const box = (id, x, y, w = 100, h = 60) => ({ id, x, y, w, h });
const edge = (from, to, route, sS = 'R', sT = 'L') => ({ id: `${from}-${to}`, from, to, sS, sT, route: route.map(([x, y]) => ({ x, y })) });
const codes = (p) => p.map((x) => x.code).sort();

test('clean orthogonal routes pass', () => {
  const nodes = [box('a', 0, 0), box('b', 200, 0)];
  assert.deepEqual(checkRoutes(nodes, [edge('a', 'b', [[100, 30], [200, 30]])]), []);
});

test('a diagonal run is reported', () => {
  const nodes = [box('a', 0, 0), box('b', 200, 100)];
  assert.deepEqual(codes(checkRoutes(nodes, [edge('a', 'b', [[100, 30], [200, 130]])])), ['W_ROUTE_DIAGONAL']);
});

test('two connectors stacked on one line are reported unless they share a source', () => {
  const nodes = [box('a', 0, 0), box('c', 0, 200), box('b', 300, 0), box('d', 300, 200)];
  const ab = edge('a', 'b', [[100, 30], [150, 30], [150, 100], [250, 100], [250, 30], [300, 30]]);
  const cd = edge('c', 'd', [[100, 230], [150, 230], [150, 100], [260, 100], [260, 230], [300, 230]]);
  assert.deepEqual(codes(checkRoutes(nodes, [ab, cd])), ['W_ROUTE_STACKED']);
  const ad = { ...cd, id: 'a-d', from: 'a' };
  assert.deepEqual(checkRoutes(nodes, [ab, ad]).filter((p) => p.code === 'W_ROUTE_STACKED'), []);
});

test('ports closer than 12px on one side are reported; decision shapes are exempt', () => {
  const nodes = [box('a', 0, 0), box('b', 300, 0), box('c', 300, 100)];
  const ab = edge('a', 'b', [[100, 25], [300, 25]]);
  const ac = edge('a', 'c', [[100, 33], [200, 33], [200, 130], [300, 130]]);
  assert.deepEqual(codes(checkRoutes(nodes, [ab, ac])), ['W_ROUTE_PORTS']);
  nodes[0].shape = 'decision';
  assert.deepEqual(checkRoutes(nodes, [ab, ac]), []);
});

test('a connector riding along a box border is reported', () => {
  const nodes = [box('a', 0, 0), box('m', 150, 30), box('b', 300, 0)];
  assert.deepEqual(codes(checkRoutes(nodes, [edge('a', 'b', [[100, 30], [300, 30]])])), ['W_ROUTE_BORDER']);
});

test('edges into one target may merge on its final stretch, but not overlap earlier', () => {
  const nodes = [box('a', 0, 0), box('c', 0, 200), box('t', 400, 100)];
  // both arrive along y=130 into t's left side: a merge
  const at = edge('a', 't', [[100, 30], [300, 30], [300, 130], [400, 130]]);
  const ct = edge('c', 't', [[100, 230], [300, 230], [300, 130], [400, 130]]);
  assert.deepEqual(checkRoutes(nodes, [at, ct]).filter((p) => p.code === 'W_ROUTE_STACKED'), []);
  // a different target: the same overlap is stacking
  const nodes2 = [...nodes, box('u', 400, 300)];
  const cu = edge('c', 'u', [[100, 230], [300, 230], [300, 130], [380, 130], [380, 330], [400, 330]]);
  assert.deepEqual(codes(checkRoutes(nodes2, [at, cu])).filter((c) => c === 'W_ROUTE_STACKED'), ['W_ROUTE_STACKED']);
});

test('a port inside a box corner is reported', () => {
  const nodes = [box('a', 0, 0), box('b', 300, 0)];
  assert.deepEqual(codes(checkRoutes(nodes, [edge('a', 'b', [[100, 3], [300, 3]])])), ['W_ROUTE_CORNER', 'W_ROUTE_CORNER']);
});
