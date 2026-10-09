// Nice linear scales + number formatting for chart renderers.

export function niceStep(range, target = 5) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return Number((step * mag).toPrecision(12));
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

// drop float noise (0.30000000000000004) from a multiple of step, at any
// magnitude (a fixed decimal count collapses domains like 0…3e-14)
function snap(v, step) {
  return Number((Math.round(v / step) * step).toPrecision(12));
}

export function ticks({ lo, hi, step }) {
  const out = [];
  for (let i = 0, v = lo; v <= hi + step * 1e-9; i++, v = lo + i * step) out.push(snap(v, step));
  return out;
}

export function fmt(v, unit = '') {
  const a = Math.abs(v);
  let s;
  if (a >= 1e12) s = `${trim(v / 1e12)}T`;
  else if (a >= 1e9) s = `${trim(v / 1e9)}B`;
  else if (a >= 1e6) s = `${trim(v / 1e6)}M`;
  else if (a >= 1e4) s = `${trim(v / 1e3)}k`;
  else s = trim(v);
  if (!unit) return s;
  if (/^[$€£¥₹]$/.test(unit)) return v < 0 ? `-${unit}${s.slice(1)}` : `${unit}${s}`;
  return unit === '%' || unit.length <= 2 ? `${s}${unit}` : `${s} ${unit}`;
}

// two decimals from 1 up; below 1, three significant digits so 0.002 and
// 0.004 stay distinct (and tiny values keep their exponent: 3e-14)
function trim(v) {
  if (Math.abs(v) >= 1 || v === 0) return String(Math.round(v * 100) / 100);
  return String(Number(v.toPrecision(3)));
}
