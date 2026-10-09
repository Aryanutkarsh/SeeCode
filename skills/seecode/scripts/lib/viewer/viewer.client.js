(() => {
  'use strict';
  const svg = document.querySelector('.sc-figure .sc-svg');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const stage = document.querySelector('.sc-stage');
  const status = document.querySelector('.sc-status');
  const tip = document.querySelector('.sc-tip');
  const panel = document.querySelector('.sc-panel');
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem('seecode:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('seecode:' + k, v); } catch (e) { /* storage unavailable */ } },
  };
  const say = (msg) => { if (status) status.textContent = msg || ''; };
  const params = new URLSearchParams(location.search);
  if (params.get('embed')) document.body.classList.add('sc-embed');
  const meta = (() => { try { return JSON.parse(($('#sc-meta') || {}).textContent || '{}'); } catch (e) { return {}; } })();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- theme ---------------------------------------------------------------
  // Dark-mode switch. Until the reader flips it, the diagram follows the system
  // setting (or ?theme=light|dark); after that their choice is remembered.
  const themeBtn = $('[data-sc-action="theme"]');
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  const isDarkNow = (t) => t === 'dark' || (t !== 'light' && systemDark.matches);
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    if (themeBtn) themeBtn.setAttribute('aria-checked', String(isDarkNow(t)));
  }
  let theme = params.get('theme') || store.get('theme') || 'auto';
  applyTheme(theme);
  systemDark.addEventListener && systemDark.addEventListener('change', () => theme === 'auto' && applyTheme(theme));
  themeBtn && themeBtn.addEventListener('click', () => {
    theme = isDarkNow(theme) ? 'light' : 'dark';
    store.set('theme', theme);
    applyTheme(theme);
  });

  // ---- motion --------------------------------------------------------------
  const hasMotion = svg.hasAttribute('data-sc-motion');
  const liveBtn = $('[data-sc-action="live"]');
  const replayBtn = $('[data-sc-action="replay"]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const forcedStill = ['static', 'still', 'end'].includes(params.get('motion') || '');
  let live = hasMotion && !forcedStill && store.get('live') !== 'off';
  // interactive overlays (hover comets, journey) animate unless reduced motion or Still
  const animated = () => !reduce && !svg.classList.contains('sc-still-ui');
  function setLive(on) {
    live = on;
    svg.classList.toggle('sc-still', !on);
    if (liveBtn) {
      liveBtn.setAttribute('aria-pressed', String(on));
      liveBtn.textContent = on ? 'Live' : 'Still';
    }
  }
  setLive(live);
  if (!hasMotion || reduce) {
    liveBtn && (liveBtn.hidden = true);
    replayBtn && (replayBtn.hidden = true);
  }
  liveBtn && liveBtn.addEventListener('click', () => {
    setLive(!live);
    svg.classList.toggle('sc-still-ui', !live);
    store.set('live', live ? 'on' : 'off');
    if (live) replay();
  });
  if (store.get('live') === 'off') svg.classList.add('sc-still-ui');
  function replay() {
    setLive(true);
    svg.getAnimations({ subtree: true }).forEach((a) => { a.cancel(); a.play(); });
  }
  replayBtn && replayBtn.addEventListener('click', () => { endStepping(); replay(); });

  // ---- step-through walkthrough (◀ ▶ or arrow keys) -------------------------
  const maxStep = Number(svg.getAttribute('data-sc-steps')) || 0;
  let stepAt = null;
  function showStep(k) {
    stepAt = Math.max(0, Math.min(maxStep, k));
    setLive(false);
    svg.classList.add('sc-stepping');
    svg.querySelectorAll('[data-sc-step]').forEach((el) => el.classList.toggle('is-shown', Number(el.getAttribute('data-sc-step')) <= stepAt));
    say(stepAt >= maxStep ? `Step ${stepAt} of ${maxStep}, the end. ◀ goes back, Replay animates.` : `Step ${stepAt} of ${maxStep}. ▶ or → for next.`);
  }
  function endStepping() {
    stepAt = null;
    svg.classList.remove('sc-stepping');
  }
  const prevBtn = $('[data-sc-action="prev"]');
  const nextBtn = $('[data-sc-action="next"]');
  if (!maxStep) { prevBtn && (prevBtn.hidden = true); nextBtn && (nextBtn.hidden = true); }
  prevBtn && prevBtn.addEventListener('click', () => showStep((stepAt ?? maxStep) - 1));
  nextBtn && nextBtn.addEventListener('click', () => showStep(stepAt === null ? 1 : stepAt + 1));

  // ---- model ---------------------------------------------------------------
  const nodeEls = new Map([...svg.querySelectorAll('[data-sc-node]')].map((n) => [n.getAttribute('data-sc-node'), n]));
  const edges = [...svg.querySelectorAll('[data-sc-edge][data-from][data-to]')].map((el) => {
    const line = el.querySelector('.e-line');
    let d = null;
    if (line && line.tagName === 'path') d = line.getAttribute('d');
    else if (line && line.tagName === 'line') d = `M${line.getAttribute('x1')},${line.getAttribute('y1')} L${line.getAttribute('x2')},${line.getAttribute('y2')}`;
    const kind = ([...el.classList].find((c) => c.startsWith('ek-')) || 'ek-default').slice(3);
    const lab = el.querySelector('.e-label');
    return { el, id: el.getAttribute('data-sc-edge'), from: el.getAttribute('data-from'), to: el.getAttribute('data-to'), d, kind, label: lab ? lab.textContent.trim() : '' };
  });
  // the spec's legend.entries labels rename kinds everywhere the viewer names them
  const LABELS = meta.labels || {};
  const KIND_NAMES = { focal: 'Focal', backend: 'Service', store: 'Store', external: 'External', input: 'Input', optional: 'Optional', security: 'Security', muted: 'Context', ...LABELS };
  const EDGE_NAMES = { default: 'Call / flow', primary: 'Primary path', link: 'HTTP / API', async: 'Async', return: 'Return', muted: 'Secondary', rel: 'Relation', ...LABELS };
  function info(id) {
    const n = nodeEls.get(id);
    if (!n) return { id, label: id };
    const kind = ([...n.classList].find((c) => c.startsWith('k-') && c !== 'k-change') || 'k-backend').slice(2);
    const subEl = n.querySelector('.n-sub');
    const tagEl = n.querySelector('.n-tag');
    return {
      id,
      label: (n.getAttribute('aria-label') || id).split(',')[0],
      sub: subEl ? subEl.textContent : '',
      tag: tagEl ? tagEl.textContent : '',
      kind,
      group: (meta.groups || {})[id],
      evidence: (meta.evidence || {})[id] || [],
    };
  }
  const label = (id) => info(id).label;
  const relations = (id) => edges.filter((e) => e.from === id || e.to === id).map((e) => ({ e, dir: e.from === e.to ? 'loop' : e.from === id ? 'out' : 'in', other: e.from === id ? e.to : e.from }));
  function reach(id, dir) {
    const depth = new Map([[id, 0]]);
    const q = [id];
    const es = new Set();
    for (let i = 0; i < q.length; i++) {
      for (const e of edges) {
        const next = dir === 'down' ? (e.from === q[i] ? e.to : null) : (e.to === q[i] ? e.from : null);
        if (next === null) continue;
        es.add(e.id);
        if (!depth.has(next)) { depth.set(next, depth.get(q[i]) + 1); q.push(next); }
      }
    }
    return { depth, es, count: depth.size - 1, hops: Math.max(0, ...depth.values()) };
  }
  function route(a, b) {
    for (const directed of [true, false]) {
      const prev = new Map([[a, null]]);
      const q = [a];
      while (q.length) {
        const id = q.shift();
        if (id === b) break;
        for (const e of edges) {
          const next = e.from === id ? e.to : !directed && e.to === id ? e.from : null;
          if (next && !prev.has(next)) { prev.set(next, e); q.push(next); }
        }
      }
      if (prev.has(b)) {
        const ids = [b];
        const es = [];
        for (let id = b; prev.get(id); ) {
          const e = prev.get(id);
          es.unshift(e);
          id = e.from === id ? e.to : e.from;
          ids.unshift(id);
        }
        return { ids, edges: es, directed };
      }
    }
    return null;
  }

  // ---- highlight + overlays ------------------------------------------------
  function clearLit() {
    svg.classList.remove('is-dim');
    svg.querySelectorAll('.is-lit,.is-past,.is-current,.is-future').forEach((x) => x.classList.remove('is-lit', 'is-past', 'is-current', 'is-future'));
    svg.querySelectorAll('[data-depth]').forEach((x) => x.removeAttribute('data-depth'));
  }
  function light(nodeIds, edgeIds) {
    clearLit();
    svg.classList.add('is-dim');
    nodeIds.forEach((id) => nodeEls.get(id) && nodeEls.get(id).classList.add('is-lit'));
    edges.forEach((e) => edgeIds.has(e.id) && e.el.classList.add('is-lit'));
  }
  let overlay = null;
  function overlayLayer() {
    if (!overlay || !overlay.isConnected) {
      overlay = document.createElementNS(NS, 'g');
      overlay.setAttribute('class', 'sc-overlay');
      overlay.setAttribute('aria-hidden', 'true');
      const nodesG = svg.querySelector('.sc-nodes');
      if (nodesG) nodesG.parentNode.insertBefore(overlay, nodesG);
      else svg.appendChild(overlay);
    }
    return overlay;
  }
  function clearOverlay() { if (overlay) overlay.replaceChildren(); }
  // A short bright dash that runs once along an edge, source → target.
  function comet(e, cls, delay = 0) {
    if (!e.d) return;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', e.d);
    p.setAttribute('pathLength', '1');
    p.setAttribute('class', `sc-comet ${cls}`);
    if (delay) p.style.animationDelay = `${delay}ms`;
    overlayLayer().appendChild(p);
  }
  // A small glyph that travels the edge, shaped by what flows on it.
  function tokenKind(e) {
    if ([e.from, e.to].some((id) => info(id).kind === 'security')) return 'security';
    if (e.kind === 'async') return 'event';
    if (e.kind === 'link' || e.kind === 'primary') return 'data';
    if (/state|lifecycle/i.test(meta.type || '')) return 'state';
    return 'call';
  }
  const GLYPHS = {
    data: '<rect x="-5" y="-4" width="10" height="8" rx="2" class="t-shape"/><path d="M-2.8-1.2h5.6M-2.8 1.4h3.8" class="t-ink"/>',
    event: '<rect x="-7" y="-3" width="4" height="6" rx="1" class="t-shape"/><rect x="-2" y="-3" width="4" height="6" rx="1" class="t-shape"/><rect x="3" y="-3" width="4" height="6" rx="1" class="t-shape"/>',
    security: '<path d="M0-5 4-3.4V0c0 3-1.6 4.5-4 5.5C-2.4 4.5-4 3-4 0v-3.4Z" class="t-shape"/><path d="m-2 .2 1.4 1.4L2-1.4" class="t-ink"/>',
    state: '<circle r="5" class="t-shape"/><circle r="1.4" class="t-dot"/>',
    call: '<path d="M-5-3-1 0-5 3M0-3 4 0 0 3" class="t-ink t-wide"/>',
  };
  function token(e) {
    if (!e.d || !animated()) return;
    const g = document.createElementNS(NS, 'g');
    const k = tokenKind(e);
    g.setAttribute('class', `sc-ftok tk-${k}`);
    g.innerHTML = `<circle r="8" class="t-halo"/>${GLYPHS[k]}`;
    g.style.offsetPath = `path('${e.d}')`;
    overlayLayer().appendChild(g);
    g.addEventListener('animationend', () => g.remove(), { once: true });
  }

  // ---- camera --------------------------------------------------------------
  let z = 1, tx = 0, ty = 0;
  let mapOn = false;
  let mini = null;
  function applyView(smooth) {
    if (smooth && !reduce) {
      svg.classList.add('sc-cam');
      clearTimeout(applyView.t);
      applyView.t = setTimeout(() => svg.classList.remove('sc-cam'), 480);
    }
    svg.style.transform = z === 1 && !tx && !ty ? '' : `translate(${tx}px,${ty}px) scale(${z})`;
    stage.classList.toggle('is-zoomed', z !== 1);
    updateMini();
  }
  // SVG elements have no offsetLeft/Top: the svg is centred horizontally in the stage.
  const offX = () => Math.max(0, (stage.clientWidth - svg.clientWidth) / 2);
  const offY = () => 0;
  function resetView(smooth = true) { z = 1; tx = 0; ty = 0; applyView(smooth); }
  // Frame a set of nodes in the free part of the stage (right of the panel).
  function frame(ids, { maxScale = 1.9, minScale = 0.7, edgeIds = [] } = {}) {
    const els = [...ids.map((id) => nodeEls.get(id)), ...edges.filter((e) => edgeIds.includes(e.id)).map((e) => e.el)];
    const boxes = els.filter(Boolean).map((n) => n.getBBox()).filter((b) => b.width || b.height);
    if (!boxes.length) return;
    const vb = svg.viewBox.baseVal;
    const W = svg.clientWidth, H = svg.clientHeight;
    const s = Math.min(W / vb.width, H / vb.height);
    const ox = (W - vb.width * s) / 2, oy = (H - vb.height * s) / 2;
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.width)), y1 = Math.max(...boxes.map((b) => b.y + b.height));
    const px = ox + ((x0 + x1) / 2 - vb.x) * s, py = oy + ((y0 + y1) / 2 - vb.y) * s;
    const bw = (x1 - x0) * s + 48, bh = (y1 - y0) * s + 48;
    const docked = panel && !panel.hidden && stage.clientWidth > 760;
    const left = docked ? panel.offsetLeft + panel.offsetWidth + 16 : 16;
    const right = stage.clientWidth - 16, top = 16, bottom = stage.clientHeight - 16;
    z = Math.max(minScale, Math.min(maxScale, Math.min((right - left) / bw, (bottom - top) / bh)));
    tx = (left + right) / 2 - offX() - z * px;
    ty = (top + bottom) / 2 - offY() - z * py;
    applyView(true);
  }
  function updateMini() {
    const show = mapOn;
    if (!show) { if (mini) mini.box.hidden = true; return; }
    if (!mini) {
      const box = document.createElement('div');
      box.className = 'sc-mini';
      box.setAttribute('aria-hidden', 'true');
      const clone = svg.cloneNode(true);
      clone.removeAttribute('style');
      clone.classList.add('sc-still');
      clone.classList.remove('is-dim', 'sc-cam');
      clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      clone.querySelectorAll('.sc-overlay').forEach((el) => el.remove());
      clone.removeAttribute('aria-labelledby');
      const view = document.createElement('div');
      view.className = 'sc-mini-view';
      box.append(clone, view);
      stage.appendChild(box);
      box.addEventListener('click', (ev) => {
        const r = box.getBoundingClientRect();
        const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
        z = Math.max(z, 1.6);
        tx = stage.clientWidth / 2 - offX() - fx * svg.clientWidth * z;
        ty = stage.clientHeight / 2 - offY() - fy * svg.clientHeight * z;
        applyView(true);
      });
      mini = { box, view };
    }
    mini.box.hidden = false;
    const W = svg.clientWidth, H = svg.clientHeight;
    const vw = stage.clientWidth / (W * z), vh = stage.clientHeight / (H * z);
    const vx = -tx / (W * z), vy = -ty / (H * z);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    mini.view.style.left = `${clamp(vx) * 100}%`;
    mini.view.style.top = `${clamp(vy) * 100}%`;
    mini.view.style.width = `${Math.min(1, vw) * 100}%`;
    mini.view.style.height = `${Math.min(1, vh) * 100}%`;
  }

  // ---- side panel (passport + journey) ------------------------------------
  function openPanel(html) {
    if (!panel) return;
    panel.innerHTML = html;
    panel.hidden = false;
    stage.style.minHeight = `${panel.offsetHeight + 32}px`;
  }
  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    panel.innerHTML = '';
    stage.style.minHeight = '';
  }

  // ---- mode state ----------------------------------------------------------
  let focus = null;
  let journey = null;
  let pick = null; // path tool: { start }
  const busy = () => !!(focus || journey || pick);

  // ---- intent trace: hover / keyboard preview ------------------------------
  let hoverTimer = null;
  function trace(id) {
    if (busy()) return;
    const rel = relations(id);
    const ns = new Set([id, ...rel.map((r) => r.other)]);
    light(ns, new Set(rel.map((r) => r.e.id)));
    clearOverlay();
    rel.forEach((r) => comet(r.e, `c-${r.dir}${animated() ? '' : ' is-static'}`));
  }
  function untrace() {
    clearTimeout(hoverTimer);
    if (busy()) return;
    clearLit();
    clearOverlay();
  }
  nodeEls.forEach((n, id) => {
    const enter = (ev) => {
      if (ev.pointerType === 'touch') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => trace(id), reduce ? 0 : 90);
    };
    n.addEventListener('pointerenter', enter);
    n.addEventListener('mouseenter', enter);
    n.addEventListener('pointerleave', untrace);
    n.addEventListener('mouseleave', untrace);
    n.addEventListener('focus', () => trace(id));
    n.addEventListener('blur', untrace);
    n.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (pick) return pickNode(id);
      if (ev.shiftKey && focus && focus !== id) return startJourney(focus, id);
      if (journey) return;
      setFocus(focus === id ? null : id);
    });
    n.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); n.click(); }
    });
  });

  // ---- focus + passport ----------------------------------------------------
  let reachMode = null;
  function setFocus(id, { silent, camera = true } = {}) {
    stopJourney({ keepPanel: true });
    focus = id;
    reachMode = null;
    clearOverlay();
    if (!id) {
      clearLit();
      closePanel();
      resetView();
      say('');
      if (!silent) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    const rel = relations(id);
    light(new Set([id, ...rel.map((r) => r.other)]), new Set(rel.map((r) => r.e.id)));
    nodeEls.get(id).classList.add('is-current');
    renderPassport(id, rel);
    if (camera) frame([id, ...rel.map((r) => r.other)], { edgeIds: rel.map((r) => r.e.id) });
    rel.forEach((r, i) => comet(r.e, `c-${r.dir}${animated() ? '' : ' is-static'}`, i * 70));
    say(`Focus: ${label(id)}. ${rel.length} connection${rel.length === 1 ? '' : 's'}. Shift-click another node for a route. Esc closes.`);
    if (!silent) history.replaceState(null, '', '#focus=' + encodeURIComponent(id));
  }
  function relRow(r) {
    const arrow = r.dir === 'out' ? 'OUT →' : r.dir === 'in' ? '← IN' : '↻ LOOP';
    return `<button class="sc-rel" data-edge="${esc(r.e.id)}" data-node="${esc(r.other)}"><span class="sc-rel-dir d-${r.dir}">${arrow}</span><span class="sc-rel-main"><b>${esc(label(r.other))}</b><small>${esc(r.e.label || (r.dir === 'out' ? 'connects to' : 'connects from'))}</small></span></button>`;
  }
  function renderPassport(id, rel) {
    const n = info(id);
    const down = reach(id, 'down'), up = reach(id, 'up');
    const outs = rel.filter((r) => r.dir !== 'in'), ins = rel.filter((r) => r.dir === 'in');
    const chips = [
      `<span class="sc-chip is-kind k-${esc(n.kind)}">${esc(KIND_NAMES[n.kind] || n.kind)}</span>`,
      meta.type ? `<span class="sc-chip">${esc(meta.type)}</span>` : '',
      n.group ? `<span class="sc-chip">${esc(n.group)}</span>` : '',
      n.tag ? `<span class="sc-chip">${esc(n.tag)}</span>` : '',
    ].join('');
    const ev = n.evidence.length
      ? `<div class="sc-p-sec"><h4>Sources</h4>${n.evidence.map((e) => `<div class="sc-src"><code>${esc(e.file)}${e.line ? ':' + e.line : ''}</code>${e.note ? `<small>${esc(e.note)}</small>` : ''}</div>`).join('')}</div>`
      : '';
    openPanel(`
      <header class="sc-p-head"><p class="sc-p-eyebrow">Node passport</p><button class="sc-p-x" data-act="close" aria-label="Close">×</button>
        <h3>${esc(n.label)}</h3>${n.sub ? `<p class="sc-p-sub">${esc(n.sub)}</p>` : ''}
        <div class="sc-chips">${chips}</div>
        <p class="sc-p-count">${outs.length} outgoing · ${ins.length} incoming</p>
        <button class="sc-p-link" data-act="copy">Copy link</button></header>
      <div class="sc-p-sec"><h4>Reach</h4><div class="sc-reach">
        <button data-act="up" ${up.count ? '' : 'disabled'} aria-pressed="false">Upstream <b>${up.count}</b></button>
        <button data-act="down" ${down.count ? '' : 'disabled'} aria-pressed="false">Downstream <b>${down.count}</b></button></div></div>
      ${outs.length ? `<div class="sc-p-sec"><h4>Outgoing · ${outs.length}</h4>${outs.map(relRow).join('')}</div>` : ''}
      ${ins.length ? `<div class="sc-p-sec"><h4>Incoming · ${ins.length}</h4>${ins.map(relRow).join('')}</div>` : ''}
      ${ev}`);
    wirePanel(id, rel);
  }
  function wirePanel(id, rel) {
    panel.querySelector('[data-act="close"]').addEventListener('click', () => setFocus(null));
    panel.querySelector('[data-act="copy"]').addEventListener('click', async (ev) => {
      const url = location.href.split('#')[0] + '#focus=' + encodeURIComponent(id);
      try { await navigator.clipboard.writeText(url); ev.target.textContent = 'Copied'; } catch (e) { ev.target.textContent = url; }
    });
    panel.querySelectorAll('.sc-reach button').forEach((b) => b.addEventListener('click', () => showReach(id, b.getAttribute('data-act'))));
    panel.querySelectorAll('.sc-rel').forEach((row) => {
      const e = edges.find((x) => x.id === row.getAttribute('data-edge'));
      row.addEventListener('mouseenter', () => {
        edges.forEach((x) => x.el.classList.toggle('is-current', x === e));
        token(e);
        comet(e, 'c-preview');
      });
      row.addEventListener('mouseleave', () => edges.forEach((x) => x.el.classList.remove('is-current')));
      row.addEventListener('click', () => setFocus(row.getAttribute('data-node')));
    });
  }
  function showReach(id, dir) {
    const wanted = reachMode === dir ? null : dir;
    reachMode = wanted;
    panel.querySelectorAll('.sc-reach button').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-act') === wanted)));
    clearOverlay();
    if (!wanted) { setFocus(id, { silent: true, camera: false }); return; }
    const r = reach(id, wanted === 'down' ? 'down' : 'up');
    light(new Set(r.depth.keys()), r.es);
    r.depth.forEach((d, nid) => nodeEls.get(nid) && nodeEls.get(nid).setAttribute('data-depth', Math.min(d, 4)));
    nodeEls.get(id).classList.add('is-current');
    edges.filter((e) => r.es.has(e.id)).forEach((e) => {
      const d = r.depth.get(wanted === 'down' ? e.from : e.to) || 0;
      comet(e, `c-reach${animated() ? '' : ' is-static'}`, d * 160);
    });
    frame([...r.depth.keys()], { maxScale: 1.6, minScale: 0.5, edgeIds: [...r.es] });
    say(`${wanted === 'down' ? 'Downstream' : 'Upstream'} of ${label(id)}: ${r.count} node${r.count === 1 ? '' : 's'} across ${r.hops} hop${r.hops === 1 ? '' : 's'}.`);
  }

  // ---- route journey -------------------------------------------------------
  const DWELL = 1100;
  function startJourney(a, b) {
    const r = route(a, b);
    focus = null;
    clearOverlay();
    if (!r) { say(`No route from ${label(a)} to ${label(b)}.`); return; }
    journey = { ...r, index: -1, playing: false, timer: null };
    light(new Set(r.ids), new Set(r.edges.map((e) => e.id)));
    openPanel(`
      <header class="sc-p-head"><p class="sc-p-eyebrow">Route journey${r.directed ? '' : ' · ignoring direction'}</p><button class="sc-p-x" data-act="close" aria-label="Close">×</button>
        <h3>${esc(label(a))} → ${esc(label(b))}</h3><p class="sc-p-count">${r.ids.length} stops · ${r.edges.length} hop${r.edges.length === 1 ? '' : 's'}</p></header>
      <div class="sc-j-controls">
        <button data-act="play" class="is-primary">▶ Play</button><button data-act="prev" aria-label="Previous stop">◀</button>
        <button data-act="next" aria-label="Next stop">▶</button><button data-act="overview">Overview</button></div>
      <ol class="sc-j-steps">${r.ids.map((id, i) => `<li><button data-i="${i}"><span>${i + 1}</span><b>${esc(label(id))}</b>${i ? `<small>${esc(r.edges[i - 1].label || 'via ' + (EDGE_NAMES[r.edges[i - 1].kind] || 'flow').toLowerCase())}</small>` : '<small>start</small>'}</button></li>`).join('')}</ol>`);
    panel.querySelector('[data-act="close"]').addEventListener('click', () => { stopJourney(); clearLit(); resetView(); say(''); history.replaceState(null, '', location.pathname + location.search); });
    panel.querySelector('[data-act="play"]').addEventListener('click', togglePlay);
    panel.querySelector('[data-act="prev"]').addEventListener('click', () => journeyStep(journey.index - 1, { stop: true }));
    panel.querySelector('[data-act="next"]').addEventListener('click', () => journeyStep(journey.index + 1, { stop: true }));
    panel.querySelector('[data-act="overview"]').addEventListener('click', journeyOverview);
    panel.querySelectorAll('.sc-j-steps button').forEach((b) => b.addEventListener('click', () => journeyStep(Number(b.getAttribute('data-i')), { stop: true })));
    history.replaceState(null, '', `#route=${encodeURIComponent(a)},${encodeURIComponent(b)}`);
    journeyOverview();
    r.edges.forEach((e, i) => comet(e, `c-reach${animated() ? '' : ' is-static'}`, i * 160));
  }
  function journeyOverview() {
    if (!journey) return;
    pauseJourney();
    journey.index = -1;
    paintJourney();
    frame(journey.ids, { maxScale: 1.5, minScale: 0.5, edgeIds: journey.edges.map((e) => e.id) });
    say(`Route: ${journey.ids.map(label).join(' → ')}. Press Play or → to walk it.`);
  }
  function paintJourney() {
    const { ids, edges: es, index } = journey;
    light(new Set(ids), new Set(es.map((e) => e.id)));
    ids.forEach((id, i) => nodeEls.get(id).classList.add(index < 0 ? 'is-lit' : i < index ? 'is-past' : i === index ? 'is-current' : 'is-future'));
    es.forEach((e, i) => e.el.classList.add(index < 0 ? 'is-lit' : i + 1 < index ? 'is-past' : i + 1 === index ? 'is-current' : 'is-future'));
    panel.querySelectorAll('.sc-j-steps button').forEach((b, i) => {
      b.classList.toggle('is-current', i === index);
      b.classList.toggle('is-past', index >= 0 && i < index);
      if (i === index) b.scrollIntoView({ block: 'nearest' });
    });
    const play = panel.querySelector('[data-act="play"]');
    if (play) play.textContent = journey.playing ? '❚❚ Pause' : index >= ids.length - 1 ? '↻ Replay' : '▶ Play';
    panel.querySelector('[data-act="prev"]').disabled = index <= 0;
    panel.querySelector('[data-act="next"]').disabled = index >= ids.length - 1;
  }
  function journeyStep(i, { stop } = {}) {
    if (!journey) return;
    if (stop) pauseJourney();
    journey.index = Math.max(0, Math.min(journey.ids.length - 1, i));
    paintJourney();
    clearOverlay();
    const j = journey.index;
    if (j > 0) { comet(journey.edges[j - 1], `c-journey${animated() ? '' : ' is-static'}`); token(journey.edges[j - 1]); }
    frame(journey.ids.slice(Math.max(0, j - 1), j + 2), { maxScale: 1.65, minScale: 0.8, edgeIds: journey.edges.slice(Math.max(0, j - 1), j + 1).map((e) => e.id) });
    const via = j > 0 ? ` (${journey.edges[j - 1].label || 'next hop'})` : '';
    say(`Stop ${j + 1} of ${journey.ids.length}: ${label(journey.ids[j])}${via}.`);
  }
  function togglePlay() {
    if (!journey) return;
    if (journey.playing) return pauseJourney();
    if (!animated()) { journeyStep(journey.index + 1); return; }
    journey.playing = true;
    if (journey.index >= journey.ids.length - 1 || journey.index < 0) journeyStep(0);
    else paintJourney();
    const tick = () => {
      if (!journey || !journey.playing) return;
      if (journey.index >= journey.ids.length - 1) { journey.playing = false; paintJourney(); say(`Journey complete: ${journey.ids.map(label).join(' → ')}.`); return; }
      journeyStep(journey.index + 1);
      journey.timer = setTimeout(tick, DWELL);
    };
    journey.timer = setTimeout(tick, DWELL);
  }
  function pauseJourney() {
    if (!journey) return;
    clearTimeout(journey.timer);
    journey.playing = false;
    paintJourney();
  }
  function stopJourney({ keepPanel } = {}) {
    if (!journey) return;
    clearTimeout(journey.timer);
    journey = null;
    clearOverlay();
    if (!keepPanel) closePanel();
  }

  // ---- path tool -----------------------------------------------------------
  const pathBtn = $('[data-sc-action="path"]');
  function setPick(on) {
    pick = on ? { start: null } : null;
    pathBtn && pathBtn.setAttribute('aria-pressed', String(!!on));
    stage.classList.toggle('is-picking', !!on);
    svg.querySelectorAll('.is-hit').forEach((x) => x.classList.remove('is-hit'));
    if (on) { setFocus(null, { silent: true }); stopJourney(); say('Path: click the start node.'); }
  }
  function pickNode(id) {
    if (!pick.start) {
      pick.start = id;
      nodeEls.get(id).classList.add('is-hit');
      say(`Path from ${label(id)}: now click the end node.`);
      return;
    }
    const a = pick.start;
    setPick(false);
    if (a !== id) startJourney(a, id);
  }
  pathBtn && pathBtn.addEventListener('click', () => setPick(!pick));
  if (pathBtn && !edges.length) pathBtn.hidden = true;

  // ---- lens (kind filter) + legend clicks ---------------------------------
  let lensKey = null;
  function applyLens(k, ek, name) {
    const key = k || `e:${ek}`;
    if (lensKey === key) { lensKey = null; clearLit(); say(''); return; }
    setFocus(null, { silent: true });
    stopJourney();
    lensKey = key;
    const ns = new Set([...nodeEls].filter(([, el]) => k && el.classList.contains(`k-${k}`)).map(([id]) => id));
    const es = new Set(edges.filter((e) => ek && e.kind === ek).map((e) => e.id));
    if (ek) edges.filter((e) => es.has(e.id)).forEach((e) => { ns.add(e.from); ns.add(e.to); });
    light(ns, es);
    clearOverlay();
    edges.filter((e) => es.has(e.id)).forEach((e, i) => comet(e, `c-reach${animated() ? '' : ' is-static'}`, (i % 6) * 120));
    say(`Lens: ${name} (${ns.size} node${ns.size === 1 ? '' : 's'}). Choose it again to clear.`);
  }
  svg.querySelectorAll('.sc-legend [data-sc-kind], .sc-legend [data-sc-ekind]').forEach((item) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => applyLens(item.getAttribute('data-sc-kind'), item.getAttribute('data-sc-ekind'), item.textContent.trim()));
  });
  const lens = $('.sc-lens');
  if (lens) {
    const kinds = [...new Set([...nodeEls.values()].map((n) => ([...n.classList].find((c) => c.startsWith('k-') && c !== 'k-change') || '').slice(2)).filter((k) => KIND_NAMES[k]))];
    const ekinds = [...new Set(edges.map((e) => e.kind))].filter((k) => EDGE_NAMES[k] && k !== 'default');
    if (kinds.length + ekinds.length < 2) lens.hidden = true;
    const list = lens.querySelector('.sc-menu-list');
    list.innerHTML = kinds.map((k) => `<button data-k="${k}" role="menuitem">${esc(KIND_NAMES[k])}</button>`).join('') + ekinds.map((k) => `<button data-ek="${k}" role="menuitem">${esc(LABELS[k] || `${EDGE_NAMES[k]} edges`)}</button>`).join('');
    lens.querySelector('[data-sc-action="lens"]').addEventListener('click', (ev) => { ev.stopPropagation(); lens.classList.toggle('is-open'); });
    list.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { lens.classList.remove('is-open'); applyLens(b.getAttribute('data-k'), b.getAttribute('data-ek'), b.textContent); }));
    document.addEventListener('click', () => lens.classList.remove('is-open'));
  }

  // ---- map -----------------------------------------------------------------
  const mapBtn = $('[data-sc-action="map"]');
  mapBtn && mapBtn.addEventListener('click', () => { mapOn = !mapOn; mapBtn.setAttribute('aria-pressed', String(mapOn)); updateMini(); });

  // ---- search --------------------------------------------------------------
  const search = $('.sc-search');
  function hits(ids) {
    svg.querySelectorAll('.is-hit').forEach((x) => x.classList.remove('is-hit'));
    ids.forEach((id) => nodeEls.get(id).classList.add('is-hit'));
  }
  if (search) {
    if (!nodeEls.size) search.hidden = true;
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const found = q ? [...nodeEls.keys()].filter((id) => (id + ' ' + nodeEls.get(id).getAttribute('aria-label')).toLowerCase().includes(q)) : [];
      hits(found);
      say(q ? `${found.length} match${found.length === 1 ? '' : 'es'}${found.length ? ', Enter to focus' : ''}` : '');
    });
    search.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const first = svg.querySelector('.is-hit');
      if (first) { hits([]); search.value = ''; setFocus(first.getAttribute('data-sc-node')); }
    });
  }

  // ---- keyboard ------------------------------------------------------------
  document.addEventListener('keydown', (ev) => {
    if (/input|textarea/i.test((ev.target && ev.target.tagName) || '')) return;
    if (ev.key === 'Escape') {
      if (pick) return setPick(false), say('');
      if (journey) { stopJourney(); clearLit(); resetView(); say(''); return; }
      if (lensKey) { lensKey = null; clearLit(); say(''); return; }
      if (!focus && isFull()) return setFull(false);
      setFocus(null);
      return;
    }
    if ((ev.key === 'f' || ev.key === 'F') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); setFull(!isFull()); return; }
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      const fwd = ev.key === 'ArrowRight';
      if (journey) { ev.preventDefault(); journeyStep(journey.index + (fwd ? 1 : -1), { stop: true }); return; }
      if (maxStep && !focus) { ev.preventDefault(); showStep(fwd ? (stepAt === null ? 1 : stepAt + 1) : (stepAt ?? maxStep) - 1); }
    }
    if (ev.key === ' ' && journey) { ev.preventDefault(); togglePlay(); }
  });

  // ---- tooltips (data-sc-tip) ----------------------------------------------
  svg.querySelectorAll('[data-sc-tip]').forEach((t) => {
    t.addEventListener('mouseenter', () => {
      if (!tip) return;
      tip.textContent = t.getAttribute('data-sc-tip');
      tip.classList.add('is-on');
    });
    t.addEventListener('mousemove', (ev) => {
      if (!tip) return;
      const r = stage.getBoundingClientRect();
      tip.style.left = ev.clientX - r.left + 12 + 'px';
      tip.style.top = ev.clientY - r.top + 12 + 'px';
    });
    t.addEventListener('mouseleave', () => tip && tip.classList.remove('is-on'));
  });

  // ---- pan / zoom input ----------------------------------------------------
  function zoomAt(f, cx, cy) {
    const nz = Math.min(6, Math.max(Math.min(1, z), z * f));
    tx = cx - offX() - ((cx - offX() - tx) * nz) / z;
    ty = cy - offY() - ((cy - offY() - ty) * nz) / z;
    z = nz;
    if (z === 1 && !focus && !journey) { tx = 0; ty = 0; }
    applyView();
  }
  stage.addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey && !ev.metaKey && z === 1 && !tx && !ty) return;
    if (ev.target.closest('.sc-panel')) return;
    ev.preventDefault();
    const r = stage.getBoundingClientRect();
    if (ev.ctrlKey || ev.metaKey) zoomAt(Math.exp(-ev.deltaY * 0.002), ev.clientX - r.left, ev.clientY - r.top);
    else { tx -= ev.deltaX; ty -= ev.deltaY; applyView(); }
  }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('[data-sc-node], .sc-panel, .sc-mini')) return;
    if (z === 1 && !tx && !ty) return;
    drag = { x: ev.clientX - tx, y: ev.clientY - ty, moved: false };
    stage.setPointerCapture(ev.pointerId);
    stage.classList.add('is-panning');
  });
  stage.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    tx = ev.clientX - drag.x;
    ty = ev.clientY - drag.y;
    drag.moved = true;
    applyView();
  });
  stage.addEventListener('pointerup', () => { drag = null; stage.classList.remove('is-panning'); });
  stage.addEventListener('dblclick', (ev) => { if (!ev.target.closest('[data-sc-node], .sc-panel')) resetView(); });
  svg.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-sc-node]') || stage.classList.contains('is-panning')) return;
    if (focus && !(drag && drag.moved)) setFocus(null);
  });
  const zoomBtn = (f) => () => zoomAt(f, stage.clientWidth / 2, stage.clientHeight / 2);
  $('[data-sc-action="zoom-in"]') && $('[data-sc-action="zoom-in"]').addEventListener('click', zoomBtn(1.25));
  $('[data-sc-action="zoom-out"]') && $('[data-sc-action="zoom-out"]').addEventListener('click', zoomBtn(0.8));

  // ---- canvas size: drag grip + full screen ---------------------------------
  // The page caps the diagram at 82vh; zooming in then leaves little room. The
  // grip below the stage makes the canvas taller (the diagram scales to fill
  // it), and full screen gives it the whole display.
  const page = $('.sc-page');
  const grip = $('.sc-grip');
  const MIN_H = 160;
  function sizeStage(h) {
    if (h == null) { stage.style.height = ''; stage.classList.remove('is-sized'); }
    else { stage.style.height = Math.max(MIN_H, Math.round(h)) + 'px'; stage.classList.add('is-sized'); }
    resetView(false);
  }
  if (grip) {
    let g = null;
    grip.addEventListener('pointerdown', (ev) => {
      g = { y: ev.clientY, h: stage.clientHeight };
      grip.setPointerCapture(ev.pointerId);
      grip.classList.add('is-dragging');
      ev.preventDefault();
    });
    grip.addEventListener('pointermove', (ev) => { if (g) sizeStage(g.h + ev.clientY - g.y); });
    const end = () => { g = null; grip.classList.remove('is-dragging'); };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => sizeStage(null));
    grip.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); sizeStage(stage.clientHeight + (ev.key === 'ArrowDown' ? 40 : -40)); }
      else if (ev.key === 'Home') { ev.preventDefault(); sizeStage(null); }
    });
  }
  const fullBtn = $('[data-sc-action="full"]');
  const isFull = () => !!page && page.classList.contains('sc-full');
  function setFull(on) {
    if (!page || on === isFull()) return;
    page.classList.toggle('sc-full', on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
    if (fullBtn) { fullBtn.setAttribute('aria-pressed', String(on)); fullBtn.textContent = on ? 'Exit full screen' : 'Full screen'; }
    // the native API when the browser allows it (not in a sandboxed iframe or
    // iOS Safari); otherwise the fixed overlay above still fills the window
    if (on && page.requestFullscreen && !document.fullscreenElement) page.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    resetView(false);
    say(on ? 'Full screen: Esc or F to exit' : '');
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && isFull()) setFull(false); });
  if (fullBtn) fullBtn.addEventListener('click', () => setFull(!isFull()));

  // ---- export --------------------------------------------------------------
  // Everything here runs in the viewer's own browser: no server, no install.
  // PNG/JPEG/SVG are the settled end frame; GIF/MP4/WebM bake the page's own
  // animations frame by frame. Encoders load on demand (jsDelivr, pinned).
  const menu = $('.sc-export');
  if (menu) {
    if (!hasMotion) menu.querySelectorAll('[data-sc-export="gif"],[data-sc-export="mp4"]').forEach((x) => x.remove());
    menu.querySelector('[data-sc-action="export"]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      menu.classList.toggle('is-open');
    });
    document.addEventListener('click', () => menu.classList.remove('is-open'));
    menu.querySelectorAll('[data-sc-export]').forEach((b) => b.addEventListener('click', () => {
      menu.classList.remove('is-open');
      doExport(b.getAttribute('data-sc-export')).catch((e) => say('Export failed: ' + e.message));
    }));
  }
  const slug = (svg.getAttribute('data-sc-slug') || 'diagram');
  // ---- content-aware export sizing ------------------------------------------
  // One rule for every export (this menu and the CLI, which calls it in-page):
  // size the output so the diagram's smallest text stays readable, within what
  // each format can carry (file size for GIF, H.264 limits for MP4).
  const BUDGET = {
    png: { maxW: 8000, maxPx: 40e6 },
    jpeg: { maxW: 8000, maxPx: 40e6 },
    webp: { maxW: 8000, maxPx: 40e6 },
    gif: { maxW: 2000, maxPx: 2.4e6 },
    mp4: { maxW: 3840, maxH: 2160, maxPx: 8.3e6 },
    webm: { maxW: 3840, maxH: 2160, maxPx: 8.3e6 },
  };
  const READABLE_PX = 9; // below this, text in an image stops being legible
  function minTextSize() {
    let min = Infinity;
    svg.querySelectorAll('text').forEach((t) => {
      if (!t.textContent.trim() || t.closest('[display="none"]')) return;
      const px = parseFloat(getComputedStyle(t).fontSize);
      if (px > 0 && px < min) min = px;
    });
    return Number.isFinite(min) ? min : 12;
  }
  function exportPlan(format, { w, h, scale } = {}) {
    const vb = svg.viewBox.baseVal;
    w = w || vb.width;
    h = h || vb.height;
    const b = BUDGET[format] || BUDGET.png;
    const minFont = minTextSize();
    // aim for the smallest text at ≥ 16 device px (≥ 2×); small diagrams get 3×
    // so they stay sharp when a doc or slide shows them large
    let target = scale || Math.max(2, 16 / minFont);
    if (!scale && w * target < 1400) target = Math.max(target, 3);
    target = Math.min(target, 4);
    const k = Math.min(target, b.maxW / w, b.maxH ? b.maxH / h : Infinity, Math.sqrt(b.maxPx / (w * h)));
    const even = format === 'mp4' || format === 'webm';
    const width = even ? Math.round(w * k) & ~1 : Math.round(w * k);
    const height = even ? Math.round(h * k) & ~1 : Math.round(h * k);
    const px = width * height;
    const fps = format === 'gif' ? (px > 1.6e6 ? 10 : px > 0.9e6 ? 12 : 15) : 30;
    const minTextPx = Math.round(minFont * k * 10) / 10;
    const warn = minTextPx < READABLE_PX
      ? `smallest text is ${minTextPx}px in this ${format.toUpperCase()}: too much content for this format; use SVG or PNG, or split the diagram`
      : null;
    return { format, scale: Math.round(k * 1000) / 1000, width, height, fps, minTextPx, warn };
  }
  const LIBS = {
    gifenc: 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js',
    mp4: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs',
    webm: 'https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.mjs',
  };
  const libCache = {};
  function lib(name) {
    if (!libCache[name]) {
      libCache[name] = import(LIBS[name]).catch(() => {
        delete libCache[name];
        throw new Error(`could not load the ${name} encoder (needs internet once)`);
      });
    }
    return libCache[name];
  }
  // Fonts as data URLs, subset to the characters drawn, so rasters and SVG
  // files keep the real typefaces (an <img>-rendered SVG can't fetch fonts).
  let fontCss = null;
  function embeddedFonts() {
    if (fontCss) return fontCss;
    const chars = new Set(' 0123456789');
    svg.querySelectorAll('text').forEach((t) => { for (const ch of t.textContent) { chars.add(ch); chars.add(ch.toUpperCase()); } });
    const text = encodeURIComponent([...chars].join(''));
    // every family the page loads: SeeCode's own plus any brand fonts
    const enc = (f) => encodeURIComponent(f).replace(/%20/g, '+').replace(/%3A/gi, ':').replace(/%40/g, '@').replace(/%3B/gi, ';').replace(/%2C/gi, ',');
    const fams = [...new Set([...document.querySelectorAll('#sc-fonts, link.sc-brand-fonts')].flatMap((l) => { try { return new URL(l.href).searchParams.getAll('family'); } catch (e) { return []; } }))].map(enc);
    const ownFaces = (document.getElementById('sc-brand-faces') || {}).textContent || '';
    const toData = async (url) => {
      const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return `data:font/woff2;base64,${btoa(bin)}`;
    };
    fontCss = Promise.all(fams.map(async (f) => {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${f}&text=${text}&display=swap`)).text();
      const faces = css.match(/@font-face\s*{[^}]*}/g) || [];
      return (await Promise.all(faces.map(async (face) => {
        const url = (face.match(/url\(([^)]+)\)/) || [])[1];
        return url ? face.replace(/url\([^)]+\)/, `url(${await toData(url)})`) : '';
      }))).join('');
    })).then(async (parts) => {
      // a brand's self-hosted faces: inline when the site allows it, else keep the link
      let own = ownFaces;
      for (const m of ownFaces.matchAll(/url\("(https:[^"]+)"\)/g)) {
        try { own = own.split(m[0]).join(`url(${await toData(m[1])})`); } catch (e) { /* blocked by the font's host */ }
      }
      return parts.join('') + own;
    }).catch(() => '');
    return fontCss;
  }
  function frameSvg(clone, fonts) {
    const cs = getComputedStyle(root);
    const names = (document.getElementById('sc-token-names').textContent || '').split(',');
    const vars = names.map((n) => `${n}:${cs.getPropertyValue(n).trim()}`).join(';');
    const css = document.getElementById('sc-diagram-css').textContent;
    const style = document.createElementNS(NS, 'style');
    const fontRule = fonts || `@import url('${document.getElementById('sc-fonts').href}');`;
    // scoped to the diagram's id so several exports can share one page
    const rules = `:root{${vars}}${css}`;
    style.textContent = `${fontRule}${clone.id && typeof __scScopeCss === 'function' ? __scScopeCss(rules, clone.id) : rules}`;
    clone.insertBefore(style, clone.firstChild);
    const h1 = document.querySelector('.sc-title');
    if (h1 && !clone.querySelector('title')) {
      const t = document.createElementNS(NS, 'title');
      t.id = h1.id;
      t.textContent = h1.textContent;
      clone.insertBefore(t, clone.firstChild);
    }
    const vb = svg.viewBox.baseVal;
    clone.setAttribute('width', vb.width);
    clone.setAttribute('height', vb.height);
    clone.setAttribute('xmlns', NS);
    return { text: new XMLSerializer().serializeToString(clone), w: vb.width, h: vb.height };
  }
  function cleanClone() {
    const clone = svg.cloneNode(true);
    clone.classList.remove('is-dim', 'sc-cam', 'sc-stepping');
    clone.removeAttribute('style');
    clone.querySelectorAll('.sc-overlay').forEach((x) => x.remove());
    clone.querySelectorAll('.is-lit,.is-hit,.is-past,.is-current,.is-future').forEach((x) => x.classList.remove('is-lit', 'is-hit', 'is-past', 'is-current', 'is-future'));
    return clone;
  }
  function standaloneSvg(fonts) {
    const clone = cleanClone();
    clone.classList.add('sc-still');
    clone.removeAttribute('data-sc-motion');
    return frameSvg(clone, fonts);
  }
  // Freeze the live animations at time t and copy their animated values onto a clone.
  const ANIMATED_PROPS = ['opacity', 'transform', 'transform-origin', 'transform-box', 'stroke-dashoffset', 'stroke-dasharray', 'clip-path', 'display'];
  const measure = document.createElementNS(NS, 'path');
  function bakeFrame(t, anims, fonts) {
    anims.forEach((a) => { a.currentTime = t; });
    const live = [svg, ...svg.querySelectorAll('*')];
    const clone = cleanClone();
    const copies = [clone, ...clone.querySelectorAll('*')];
    live.forEach((el, i) => {
      if (!el.getAnimations || !el.getAnimations().length) return;
      const cs = getComputedStyle(el);
      const c = copies[i];
      ANIMATED_PROPS.forEach((p) => c.style.setProperty(p, cs.getPropertyValue(p)));
      const op = cs.getPropertyValue('offset-path');
      const m = op && op.match(/path\("(.+)"\)/);
      if (m) {
        // flow tokens: resolve their motion-path position into a plain translate
        // (the measuring path must be in the document for getTotalLength to work)
        if (!measure.isConnected) { measure.setAttribute('visibility', 'hidden'); measure.setAttribute('fill', 'none'); svg.appendChild(measure); }
        measure.setAttribute('d', m[1]);
        const len = measure.getTotalLength();
        const pt = measure.getPointAtLength((parseFloat(cs.getPropertyValue('offset-distance')) / 100) * len);
        c.style.setProperty('offset-path', 'none');
        c.style.setProperty('transform', `translate(${pt.x}px, ${pt.y}px)`);
        c.style.setProperty('transform-box', 'view-box');
        c.style.setProperty('transform-origin', '0 0');
        c.style.setProperty('display', cs.display === 'none' ? 'none' : 'inline');
      }
    });
    if (measure.isConnected) measure.remove();
    const style = document.createElementNS(NS, 'style');
    style.textContent = '*{animation:none!important;transition:none!important}';
    clone.appendChild(style);
    return frameSvg(clone, fonts).text;
  }
  function svgToCanvas(text, w, h, k, canvas) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = getComputedStyle(root).getPropertyValue('--sc-paper').trim() || '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('could not rasterize SVG'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    });
  }
  function download(blob, name) {
    window.SeeCode.lastExport = { name, size: blob.size, type: blob.type, blob };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function raster(type) {
    const s = standaloneSvg(await embeddedFonts());
    const plan = exportPlan(type === 'image/jpeg' ? 'jpeg' : 'png');
    if (plan.warn) say(plan.warn);
    const k = plan.scale;
    const c = document.createElement('canvas');
    c.width = Math.round(s.w * k);
    c.height = Math.round(s.h * k);
    await svgToCanvas(s.text, s.w, s.h, k, c);
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas empty'))), type, 0.92));
  }
  // Render every frame of the animation into canvases.
  async function frames({ fps, plan }) {
    endStepping();
    setFocus(null, { silent: true });
    stopJourney();
    clearLit();
    clearOverlay();
    const wasLive = live;
    setLive(true);
    svg.classList.remove('sc-still-ui');
    const anims = svg.getAnimations({ subtree: true }).filter((a) => !(a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.sc-overlay')));
    anims.forEach((a) => { a.cancel(); a.play(); a.pause(); });
    let finite = 0, loop = 0;
    for (const a of anims) {
      const t = a.effect.getComputedTiming();
      if (t.iterations === Infinity) loop = Math.max(loop, (t.delay || 0) + (t.duration || 0));
      else finite = Math.max(finite, t.endTime || 0);
    }
    const settle = parseFloat(getComputedStyle(svg).getPropertyValue('--sc-settle')) || 0;
    const total = Math.min(14000, Math.max(finite, settle, loop) + 900);
    const fonts = await embeddedFonts();
    const vb = svg.viewBox.baseVal;
    const k = plan.scale;
    const W = plan.width & ~1, H = plan.height & ~1;
    const count = Math.max(2, Math.round((total / 1000) * fps));
    const out = [];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      await svgToCanvas(bakeFrame((i * 1000) / fps, anims, fonts), vb.width, vb.height, k, c);
      out.push(c);
      if (i % 5 === 0) say(`Rendering frames ${i + 1}/${count}…`);
    }
    anims.forEach((a) => a.play());
    setLive(wasLive);
    return { canvases: out, W, H };
  }
  async function exportGif() {
    say('Loading GIF encoder…');
    const { GIFEncoder, quantize, applyPalette } = await lib('gifenc');
    const plan = exportPlan('gif');
    const fps = plan.fps;
    const { canvases, W, H } = await frames({ fps, plan });
    say('Encoding GIF…');
    const data = (c) => c.getContext('2d').getImageData(0, 0, W, H).data;
    // one palette from the finished frame (index 255 = "unchanged", transparent)
    const palette = quantize(data(canvases[canvases.length - 1]), 255);
    while (palette.length < 255) palette.push([0, 0, 0]);
    palette.push([255, 0, 255]);
    const gif = GIFEncoder();
    let prev = null;
    canvases.forEach((c, i) => {
      const idx = applyPalette(data(c), palette.slice(0, 255));
      let frame = idx;
      if (prev) { frame = new Uint8Array(idx.length); for (let p = 0; p < idx.length; p++) frame[p] = idx[p] === prev[p] ? 255 : idx[p]; }
      gif.writeFrame(frame, W, H, { palette: i ? undefined : palette, delay: i === canvases.length - 1 ? 1600 : Math.round(1000 / fps), repeat: 0, transparent: i > 0, transparentIndex: 255, dispose: 1 });
      prev = idx;
    });
    gif.finish();
    download(new Blob([gif.bytes()], { type: 'image/gif' }), slug + '.gif');
    say(`GIF saved: ${W}×${H}, ${canvases.length} frames.${plan.warn ? ` Note: ${plan.warn}.` : ''}`);
  }
  async function exportVideo() {
    if (typeof VideoEncoder === 'undefined') throw new Error('this browser has no WebCodecs video encoder; try Chrome, Edge or Safari');
    const fps = 30;
    const plan = exportPlan('mp4');
    const { canvases, W, H } = await frames({ fps, plan });
    let kind = 'mp4', codec = null;
    for (const c of ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e01f']) {
      if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 6e6, framerate: fps }).catch(() => ({}))).supported) { codec = c; break; }
    }
    if (!codec) {
      kind = 'webm';
      for (const c of ['vp09.00.40.08', 'vp8']) {
        if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 6e6, framerate: fps }).catch(() => ({}))).supported) { codec = c; break; }
      }
    }
    if (!codec) throw new Error('no H.264 or VP9 encoder available in this browser');
    say(`Loading ${kind.toUpperCase()} muxer…`);
    const M = await lib(kind);
    const target = new M.ArrayBufferTarget();
    const muxer = kind === 'mp4'
      ? new M.Muxer({ target, video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' })
      : new M.Muxer({ target, video: { codec: codec.startsWith('vp09') ? 'V_VP9' : 'V_VP8', width: W, height: H, frameRate: fps } });
    let failure = null;
    const enc = new VideoEncoder({ output: (chunk, m) => muxer.addVideoChunk(chunk, m), error: (e) => { failure = e; } });
    enc.configure({ codec, width: W, height: H, bitrate: Math.min(12e6, W * H * fps * 0.12), framerate: fps, ...(kind === 'mp4' ? { avc: { format: 'avc' } } : {}) });
    say(`Encoding ${kind.toUpperCase()}…`);
    const seq = canvases.concat(Array(Math.round(fps * 1.2)).fill(canvases[canvases.length - 1]));
    for (let i = 0; i < seq.length; i++) {
      const vf = new VideoFrame(seq[i], { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    }
    await enc.flush();
    if (failure) throw failure;
    muxer.finalize();
    download(new Blob([target.buffer], { type: kind === 'mp4' ? 'video/mp4' : 'video/webm' }), `${slug}.${kind}`);
    say(`${kind.toUpperCase()} saved: ${W}×${H}, ${(seq.length / fps).toFixed(1)} s.${plan.warn ? ` Note: ${plan.warn}.` : ''}`);
  }
  async function doExport(kind) {
    if (kind === 'svg') return download(new Blob([standaloneSvg(await embeddedFonts()).text], { type: 'image/svg+xml' }), slug + '.svg');
    if (kind === 'png') return download(await raster('image/png'), slug + '.png');
    if (kind === 'jpeg') return download(await raster('image/jpeg'), slug + '.jpg');
    if (kind === 'gif') return exportGif();
    if (kind === 'mp4') return exportVideo();
    if (kind === 'copy') {
      const blob = await raster('image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      say('PNG copied to clipboard.');
    }
  }

  // ---- deep links ----------------------------------------------------------
  function applyHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const fm = hash.match(/^focus=(.+)$/);
    const rm = hash.match(/^route=([^,]+),(.+)$/);
    if (fm && nodeEls.has(fm[1])) setFocus(fm[1], { silent: true });
    else if (rm && nodeEls.has(rm[1]) && nodeEls.has(rm[2])) startJourney(rm[1], rm[2]);
  }
  // Layout is measured for SeeCode's fonts; a brand typeface can run wider.
  // Once fonts load, squeeze any label that would spill out of its box.
  function fitLabels() {
    svg.querySelectorAll('.sc-node').forEach((g) => {
      const box = g.querySelector('.n-box');
      if (!box || !box.getBBox) return;
      const room = box.getBBox().width - 12;
      g.querySelectorAll('text.n-label, text.n-sub').forEach((t) => {
        if (room > 0 && t.getComputedTextLength() > room) {
          t.setAttribute('textLength', room.toFixed(1));
          t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        }
      });
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLabels);
  requestAnimationFrame(applyHash);
  window.addEventListener('hashchange', applyHash);

  window.SeeCode = { replay, setLive, setFocus, startJourney, route, reach, frame, resetView, standaloneSvg, doExport, bakeFrame, exportPlan };
})();
