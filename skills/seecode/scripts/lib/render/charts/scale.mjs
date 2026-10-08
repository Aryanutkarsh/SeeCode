// Nice linear scales + number formatting for chart renderers.

export function niceStep(range, target = 5) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * mag;
}

// Always includes zero and always has a span: all-zero (or empty) data
// would otherwise give lo === hi and every mapped value would be NaN.
export function niceDomain(min, max, target = 5) {
  const lo = Math.min(0, Number.isFinite(min) ? min : 0), hi = Math.max(0, Number.isFinite(max) ? max : 0);
  const step = niceStep(hi - lo || 1, target);
  const dom = { lo: snap(Math.floor(lo / step) * step, step), hi: snap(Math.ceil(hi / step) * step, step), step };
  if (dom.hi <= dom.lo) dom.hi = snap(dom.lo + step, step);
  return dom;
}

// Lower bound for a non-zero baseline (zero:false): a whole step at or below
// `min`, and never so high that the domain collapses.
export function floorTo(dom, min) {
  return snap(Math.min(Math.floor(min / dom.step) * dom.step, dom.hi - dom.step), dom.step);
}

// drop float noise (0.30000000000000004) from a multiple of step
function snap(v, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(v.toFixed(Math.min(12, d)));
}

export function ticks({ lo, hi, step }) {
  const out = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export function fmt(v, unit = '') {
  const a = Math.abs(v);
  let s;
  if (a >= 1e9) s = `${trim(v / 1e9)}B`;
  else if (a >= 1e6) s = `${trim(v / 1e6)}M`;
  else if (a >= 1e4) s = `${trim(v / 1e3)}k`;
  else s = trim(v);
  if (!unit) return s;
  if (/^[$€£¥₹]$/.test(unit)) return v < 0 ? `-${unit}${s.slice(1)}` : `${unit}${s}`;
  return unit === '%' || unit.length <= 2 ? `${s}${unit}` : `${s} ${unit}`;
}

function trim(v) {
  return String(Math.round(v * 100) / 100);
}
