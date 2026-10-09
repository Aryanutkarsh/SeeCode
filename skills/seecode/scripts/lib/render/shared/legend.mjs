import { el, text } from '../../svg.mjs';
import { textWidth } from '../../text.mjs';

const NODE_NAMES = { focal: 'Focal', backend: 'Service', store: 'Store', external: 'External', input: 'Input', optional: 'Optional', security: 'Security', muted: 'Context' };
const EDGE_NAMES = { default: 'Call / flow', primary: 'Primary path', link: 'HTTP / API', async: 'Async', return: 'Return', muted: 'Secondary' };

// spec.legend may be true/false or { title, entries: { <key>: { label, visible } } },
// where <key> is a node kind, edge kind, status, change or series name.
export function legendOptions(spec) {
  const l = spec && spec.legend;
  return l && typeof l === 'object' ? { title: l.title, entries: l.entries || {} } : { entries: {} };
}

// Custom names per key, for the viewer's lens menu and detail panel.
export function legendLabels(spec) {
  const { entries } = legendOptions(spec);
  return Object.fromEntries(Object.entries(entries).filter(([, e]) => e && e.label).map(([k, e]) => [k, e.label]));
}

// Returns { svg, h, keys } for a legend strip starting at (x, y) spanning
// width w. `keys` lists every key that could be relabelled, shown or not.
export function legend({ nodeKinds = [], edgeKinds = [], x, y, w, extra = [], custom = { entries: {} } }) {
  const entries = custom.entries || {};
  const all = [
    ...nodeKinds.map((k) => ({ type: 'node', k, key: k, label: NODE_NAMES[k] || k })),
    ...edgeKinds.map((k) => ({ type: 'edge', k, key: k, label: EDGE_NAMES[k] || k })),
    ...extra,
  ];
  const keys = all.map((it) => it.key).filter(Boolean);
  const items = all
    .filter((it) => !(it.key && entries[it.key] && entries[it.key].visible === false))
    .map((it) => (it.key && entries[it.key] && entries[it.key].label ? { ...it, label: entries[it.key].label } : it));
  if (items.length < 2) return { svg: '', h: 0, keys };
  const parts = [
    el('line', { class: 'lg-rule', x1: x, y1: y, x2: x + w, y2: y }),
    text({ class: 'lg-title', x, y: y + 16 }, (custom.title || 'Legend').toUpperCase()),
  ];
  let cx = x;
  let cy = y + 34;
  for (const it of items) {
    const tw = textWidth(it.label, { size: 9 }) + (it.type === 'text' ? 24 : 44);
    if (cx + tw > x + w && cx > x) {
      cx = x;
      cy += 18;
    }
    const hit = it.type === 'node' ? { 'data-sc-kind': it.k } : it.type === 'edge' ? { 'data-sc-ekind': it.k } : {};
    const start = parts.length;
    if (it.type === 'node') {
      parts.push(el('g', { class: `k-${it.k}` }, el('rect', { class: 'n-box', x: cx, y: cy - 8, width: 14, height: 10, rx: 2 })));
    } else if (it.type === 'edge') {
      const dashed = it.k === 'async' || it.k === 'return';
      parts.push(el('g', { class: `ek-${it.k}` }, [
        el('path', { class: `e-line${dashed ? ' dashed' : ''}`, d: `M${cx},${cy - 3} L${cx + 20},${cy - 3}` }),
        el('path', { class: `e-head m-${dashed ? 'default' : it.k}`, d: `M${cx + 26},${cy - 3} L${cx + 19},${cy - 6} L${cx + 19},${cy} Z` }),
      ]));
    } else if (it.swatch) {
      parts.push(el('rect', { class: it.swatch, x: cx, y: cy - 8, width: 14, height: 10, rx: 2 }));
    }
    parts.push(text({ class: 'lg-text', x: cx + (it.type === 'edge' ? 32 : it.type === 'text' ? 0 : 20), y: cy }, it.label));
    if (hit['data-sc-kind'] || hit['data-sc-ekind']) parts.splice(start, parts.length - start, el('g', hit, [el('rect', { x: cx - 2, y: cy - 11, width: tw - 6, height: 15, fill: 'transparent' }), ...parts.slice(start)]));
    cx += tw;
  }
  return { svg: el('g', { class: 'sc-legend' }, parts), h: cy - y + 10, keys };
}
