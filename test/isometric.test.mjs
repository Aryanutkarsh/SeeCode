// Isometric types: the projection, exploded views and plans.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iso, prism } from '../skills/seecode/scripts/lib/render/structure/axon.mjs';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { skinCss } from '../skills/seecode/scripts/lib/tokens.mjs';

const svgOf = (r) => r.html.slice(r.html.indexOf('<svg class="sc-svg'), r.html.indexOf('</svg>'));
const nums = (s) => s.match(/-?[\d.]+/g).map(Number);

test('one projection: x right-down, y left-down, z up (2:1)', () => {
  assert.deepEqual(iso(10, 0, 0), { x: 10, y: 5 });
  assert.deepEqual(iso(0, 10, 0), { x: -10, y: 5 });
  assert.deepEqual(iso(0, 0, 10), { x: 0, y: -10 });
});

test('a prism has shaded lit and shade faces, a top, and a convex silhouette', () => {
  const p = prism({ x0: 0, y0: 0, x1: 100, y1: 60, r: 0 }, 0, 10);
  for (const cls of ['iso-l', 'iso-r', 'iso-t', 'iso-sil']) assert.match(p.svg, new RegExp(`class="${cls}"`), cls);
  // a box's silhouette has 6 corners in this view
  assert.equal(p.sil.length, 6);
  const rounded = prism({ x0: 0, y0: 0, x1: 100, y1: 60, r: 12 }, 0, 10);
  assert.ok(rounded.sil.length > 6, 'rounded corners add points');
  assert.doesNotMatch(rounded.svg, /NaN/);
});

const phone = {
  type: 'exploded', title: 'Phone',
  parts: [
    { id: 'housing', label: 'Housing', w: 160, d: 300, t: 18, r: 28 },
    { id: 'board', label: 'Board', w: 70, d: 200, t: 8, x: -36, y: -30, level: 1, focal: true },
    { id: 'battery', label: 'Battery', w: 64, d: 190, t: 10, x: 40, y: 10, level: 1 },
    { id: 'display', label: 'Display', kind: 'display', w: 160, d: 300, t: 8, r: 28, level: 2 },
  ],
};

test('exploded: even gap, labels in one column on horizontal leaders, parts lift top first', () => {
  const r = renderSpec(phone);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.deepEqual((r.result.problems || []).filter((p) => !p.code.startsWith('I_')), []);
  const svg = svgOf(r);
  const leaders = [...svg.matchAll(/<line class="iso-leader"[^>]*x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)].map((m) => m.slice(1).map(Number));
  assert.equal(leaders.length, 4);
  for (const [, y1, , y2] of leaders) assert.equal(y1, y2, 'leaders never bend');
  assert.equal(new Set(leaders.map((l) => l[2])).size, 1, 'one label column');
  const ys = leaders.map((l) => l[1]).sort((a, b) => a - b);
  // labels of different levels sit at least 36px apart (board and battery share a level)
  assert.ok(ys[1] - ys[0] >= 36 && ys[3] - ys[2] >= 36, ys.join(','));
  const part = (id) => new RegExp(`<g class="([^"]*)" data-sc-node="${id}" data-sc-step="(\\d+)" data-level="(\\d+)" style="--step:\\d+;--lift:(-?\\d+)px"`).exec(svg);
  assert.equal(part('display')[2], '1', 'the top level lifts first');
  assert.equal(part('board')[2], part('battery')[2], 'one level lifts together');
  assert.equal(part('housing')[4], '0');
  assert.doesNotMatch(part('housing')[1], /sc-lift/, 'the bottom level stays put');
  assert.ok(Number(part('display')[4]) > Number(part('board')[4]), 'higher levels travel further');
  assert.match(part('board')[1], /k-focal/);
  assert.match(svg, /class="it-dark"/, 'the display preset draws a dark screen');
});

test('exploded: parts can be plain labels; repeated items draw one piece per cell', () => {
  const r = renderSpec({ type: 'exploded', title: 'Stack', parts: ['Base', 'Middle', 'Top'] });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  const g = renderSpec({ type: 'exploded', title: 'Keys', parts: [{ label: 'Case', w: 300, d: 120 }, { label: 'Keycaps', w: 280, d: 100, t: 4, items: [{ repeat: [6, 2], h: 6, fill: 0.8 }] }] });
  assert.equal(g.ok, true, JSON.stringify(g.problems));
  const caps = /data-sc-node="p1"[\s\S]*?<\/g><\/g>/.exec(svgOf(g))[0];
  assert.equal([...caps.matchAll(/class="iso-solid it-solid/g)].length, 12);
});

test('exploded: two side-by-side parts labelled too close together warn', () => {
  const r = renderSpec({ type: 'exploded', title: 'Crowded', parts: [{ label: 'Tray', w: 200, d: 200 }, { label: 'A', w: 60, d: 60, x: 40, y: -20, level: 1 }, { label: 'B', w: 60, d: 60, x: 40, y: 20, level: 1 }] });
  assert.ok(r.result.problems.some((p) => p.code === 'W_EXPLODED_LABELS'), JSON.stringify(r.result.problems));
});

const office = {
  type: 'isometric-plan', title: 'Office',
  rooms: [
    { id: 'open', label: 'Open office', x: 0, y: 0, w: 260, d: 180, walls: true, door: 'S' },
    { id: 'meet', label: 'Meeting', x: 260, y: 0, w: 120, d: 100, walls: true, door: 'S', focal: true },
    { id: 'kitchen', label: 'Kitchen', x: 260, y: 100, w: 120, d: 80, walls: true, door: 'W' },
  ],
  boxes: [{ id: 'd1', x: 30, y: 30, w: 60, d: 30, step: 1 }, { id: 'd2', x: 30, y: 110, w: 60, d: 30, step: 2 }],
};

test('plan: touching rooms share one wall, and a door cuts through it', () => {
  const r = renderSpec(office);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.deepEqual((r.result.problems || []).filter((p) => !p.code.startsWith('I_')), []);
  // no wall boxes overlap each other on the plate (one wall per shared edge)
  const svg = svgOf(r);
  assert.ok([...svg.matchAll(/data-kind="wall"/g)].length >= 8);
  assert.equal([...svg.matchAll(/class="sc-node iso-tag/g)].length, 3);
  assert.match(svg, /class="sc-node iso-tag k-focal/);
  assert.match(svg, /iso-box iso-furniture sc-drop" data-kind="furniture" data-sc-step="1"/);
  assert.equal(r.result.steps, 2);
});

test('plan: overlapping footprints and boxes off the plate warn', () => {
  const r = renderSpec({ type: 'isometric-plan', title: 'Bad', plate: { w: 100, d: 100 }, boxes: [{ id: 'a', x: 10, y: 10, w: 40, d: 40 }, { id: 'b', x: 30, y: 30, w: 40, d: 40 }, { id: 'c', x: 90, y: 90, w: 40, d: 40 }] });
  const codes = r.result.problems.map((p) => p.code);
  assert.ok(codes.includes('W_PLAN_OVERLAP') && codes.includes('W_PLAN_BOUNDS'), codes.join(','));
});

test('plan: a long wall paints before the furniture in front of it', () => {
  const r = renderSpec({ type: 'isometric-plan', title: 'Order', boxes: [{ id: 'desk', x: 40, y: 40, w: 40, d: 20 }, { id: 'wall', kind: 'building', x: 0, y: 0, w: 300, d: 6, h: 22 }, { id: 'tree', kind: 'tree', x: 200, y: 60, w: 20, d: 20 }] });
  const svg = svgOf(r);
  const order = [...svg.matchAll(/<g class="iso-box iso-(\w+)/g)].map((m) => m[1]);
  assert.ok(order.indexOf('building') < order.indexOf('furniture'), order.join(','));
  assert.match(svg, /class="iso-solid iso-canopy"/);
});

test('isometric shading has light and dark values, and follows a dark brand', () => {
  const css = skinCss({});
  assert.match(css, /:root\{[^}]*--sc-ax-r-o:0\.16/);
  assert.match(css, /data-theme="dark"\]\{[^}]*--sc-ax-r-o:0\.42/);
  assert.match(skinCss({ brand: { paper: '#111111', ink: '#eeeeee' } }), /:root\{[^}]*--sc-ax-shade:#000000/);
});

// ---- the composition engine ----------------------------------------------

const one = (part) => renderSpec({ type: 'exploded', title: 'T', parts: [{ label: 'Base' }, { label: 'Part', ...part }] });

test('items nest: a raised item carries its own items on top', () => {
  const r = one({ items: [{ box: [0.1, 0.1, 0.5, 0.5], h: 5, items: [{ at: [0.5, 0.5], size: [0.4, 0.4], r: 'round', h: 2, tone: 'dark', items: [{ shape: 'ring', box: [0.2, 0.2, 0.8, 0.8], r: 'round', tone: 'light' }] }] }] });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  const svg = svgOf(r);
  assert.match(svg, /iso-solid it-solid it-light/);
  assert.match(svg, /iso-solid it-solid it-dark/);
  assert.match(svg, /class="it-line it-stroke-light"/);
});

test('every flat shape and side shape draws without NaN', () => {
  const items = ['panel', 'hole', 'ring', 'lines', 'text', 'dots'].map((shape, i) => ({ shape, box: [0.05 + i * 0.15, 0.1, 0.15 + i * 0.15, 0.9], ...(shape === 'dots' ? { repeat: [1, 4] } : {}) }));
  const side = ['panel', 'lines', 'text', 'button'].map((shape, i) => ({ face: i % 2 ? 'right' : 'both', shape, box: [0.1 + i * 0.2, 0.2, 0.25 + i * 0.2, 0.8] }));
  const r = one({ t: 30, items, side, rings: true });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.doesNotMatch(svgOf(r), /NaN|undefined/);
  for (const cls of ['it-cut', 'it-text', 'it-button']) assert.match(svgOf(r), new RegExp(cls), cls);
});

test('a hollow part paints its front after the parts that sit inside it', () => {
  const r = renderSpec({ type: 'exploded', title: 'Tray', parts: [{ id: 'tray', label: 'Tray', kind: 'tray', w: 200, d: 120, t: 20 }, { id: 'inside', label: 'Inside', w: 120, d: 60, t: 8, level: 1 }, { id: 'lid', label: 'Lid', w: 200, d: 120, t: 6, level: 2 }] });
  const svg = svgOf(r);
  const iInside = svg.indexOf('data-sc-node="inside"'), iFront = svg.indexOf('iso-hollow-front'), iLid = svg.indexOf('data-sc-node="lid"');
  assert.ok(svg.indexOf('iso-hollow-back') < iInside && iInside < iFront && iFront < iLid, [iInside, iFront, iLid].join(','));
});

test('the gap opens until no part covers a part on another level', () => {
  const r = renderSpec({ type: 'exploded', title: 'Gap', parts: [{ label: 'A', w: 200, d: 200, t: 6 }, { label: 'B', w: 200, d: 200, t: 6 }] });
  assert.ok(Number(/data-gap="(\d+)"/.exec(svgOf(r))[1]) >= 180, 'two equal 200×200 slabs need about a top face of clearance');
  const tight = renderSpec({ type: 'exploded', title: 'Gap', gap: 40, parts: [{ label: 'A', w: 200, d: 200, t: 6 }, { label: 'B', w: 200, d: 200, t: 6 }] });
  assert.match(svgOf(tight), /data-gap="40"/, 'an explicit gap wins');
});

test('presets are shorthands: a spec adds its own items on top of them', () => {
  const r = one({ kind: 'display', items: [{ shape: 'text', box: [0.2, 0.3, 0.8, 0.6], tone: 'light' }] });
  const svg = svgOf(r);
  assert.match(svg, /class="it-dark"/);
  assert.match(svg, /class="it-text it-stroke-light"/);
  assert.equal(one({ kind: 'nonsense' }).ok, false);
});

test('plan boxes take presets, items and side details too', () => {
  const r = renderSpec({ type: 'isometric-plan', title: 'P', marks: [{ kind: 'road', x: 0, y: 100, w: 300, d: 20 }], boxes: [{ id: 'b', kind: 'building', label: 'HQ', x: 0, y: 0, w: 120, d: 80, h: 40 }, { kind: 'table', x: 150, y: 20, w: 24, d: 24, h: 10 }, { kind: 'rack', x: 200, y: 20, w: 20, d: 60, h: 50 }, { x: 240, y: 20, w: 40, d: 40, h: 12, items: [{ repeat: [2, 2], h: 6 }] }] });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  const svg = svgOf(r);
  assert.match(svg, /it-line it-dash iso-centreline/);
  assert.match(svg, /it-line it-dash it-stroke-dark/, 'building windows');
  assert.ok([...svg.matchAll(/iso-solid it-solid/g)].length >= 4);
});

test('shaped tops: domes, gable, hip and shed roofs draw, and flat items drape onto them', async () => {
  const { capHeight } = await import('../skills/seecode/scripts/lib/render/structure/axon.mjs');
  for (const top of ['dome', 'gable', 'hip', 'shed']) {
    const r = renderSpec({ type: 'isometric-plan', title: top, boxes: [{ id: 'b', label: 'B', x: 0, y: 0, w: 120, d: 80, h: 20, top, topH: 30, items: [{ shape: 'ring', at: [0.5, 0.5], size: [0.2, 0.2] }] }] });
    assert.equal(r.ok, true, `${top}: ${JSON.stringify(r.problems)}`);
    assert.match(svgOf(r), /iso-facet/, top);
    assert.doesNotMatch(svgOf(r), /NaN/, top);
  }
  // a dome is highest in the middle and zero at the rim; a shed is high at the back
  const dome = capHeight({ x0: 0, y0: 0, x1: 100, y1: 100, r: 50 }, 40, 'dome');
  assert.ok(Math.abs(dome(50, 50) - 40) < 0.01 && dome(0, 50) < 0.01 && dome(50, 50) > dome(25, 50));
  const shed = capHeight({ x0: 0, y0: 0, x1: 100, y1: 100 }, 20, 'shed');
  assert.ok(shed(50, 0) > shed(50, 100));
});

test('a roof replaces a preset\'s flat-roof items; presets with their own top keep them', () => {
  const flatRoof = renderSpec({ type: 'isometric-plan', title: 'F', boxes: [{ kind: 'building', x: 0, y: 0, w: 100, d: 80, h: 30 }] });
  const hip = renderSpec({ type: 'isometric-plan', title: 'H', boxes: [{ kind: 'building', top: 'hip', x: 0, y: 0, w: 100, d: 80, h: 30 }] });
  assert.match(svgOf(flatRoof), /it-line it-dash"/, 'flat roof keeps its dashed parapet');
  assert.doesNotMatch(svgOf(hip), /it-line it-dash"/, 'a hip roof drops the parapet');
  assert.match(svgOf(renderSpec({ type: 'exploded', title: 'Bun', parts: ['Base', { label: 'Bun', kind: 'bun', w: 120, d: 120 }] })), /iso-contour/);
});

test('dark panels keep a visible edge in dark themes only', () => {
  const css = skinCss({});
  assert.match(css, /:root\{[^}]*--sc-ax-dark-edge:rgba\(255,255,255,0\)/);
  assert.match(css, /data-theme="dark"\]\{[^}]*--sc-ax-dark-edge:rgba\(255,255,255,0\.34\)/);
  assert.match(skinCss({ brand: { paper: '#111111', ink: '#eeeeee' } }), /:root\{[^}]*--sc-ax-dark-edge:rgba\(255,255,255,0\.34\)/);
});
