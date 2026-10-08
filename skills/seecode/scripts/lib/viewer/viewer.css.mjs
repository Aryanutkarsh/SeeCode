// Page + viewer chrome styles (outside the SVG).
import { FONT } from '../tokens.mjs';

export const VIEWER_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--sc-paper);color:var(--sc-ink)}
body{font-family:${FONT.sans};min-height:100vh;display:flex;justify-content:center;padding:48px 24px 40px}
.sc-page{width:100%;max-width:var(--sc-max,1200px)}
.sc-head{margin-bottom:20px;max-width:760px}
.sc-eyebrow{font-family:${FONT.mono};font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--sc-muted);margin-bottom:8px}
.sc-title{font-family:${FONT.serif};font-weight:400;font-size:clamp(26px,2.4vw + 12px,36px);line-height:1.12;letter-spacing:-.015em;color:var(--sc-ink)}
.sc-subtitle{margin-top:8px;color:var(--sc-muted);font-size:15px;line-height:1.5}
.sc-figure{position:relative;border-radius:10px}
.sc-stage{position:relative;overflow:hidden;border-radius:10px;touch-action:none}
.sc-stage .sc-svg{-webkit-user-select:none;user-select:none}
.sc-stage.is-zoomed{cursor:grab;outline:1px solid var(--sc-rule)}
.sc-stage.is-panning{cursor:grabbing}
.sc-svg{display:block;width:100%;height:auto;max-height:82vh;margin:0 auto;transform-origin:0 0}
.sc-caption{margin-top:14px;color:var(--sc-muted);font-family:${FONT.serif};font-style:italic;font-size:15px;max-width:760px}
.sc-evidence{margin-top:16px;font-family:${FONT.mono};font-size:11px;color:var(--sc-soft);line-height:1.7}
.sc-evidence summary{cursor:pointer;letter-spacing:.14em;text-transform:uppercase}
.sc-evidence code{color:var(--sc-muted)}
.sc-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}
.sc-btn,.sc-search{font:500 11px/1 ${FONT.mono};letter-spacing:.06em;color:var(--sc-muted);background:transparent;border:1px solid var(--sc-rule);border-radius:6px;padding:7px 10px;cursor:pointer}
.sc-btn:hover{color:var(--sc-ink);border-color:var(--sc-rule-solid)}
.sc-btn[aria-pressed="true"]{color:var(--sc-accent);border-color:var(--sc-accent)}
.sc-theme{display:inline-flex;align-items:center;gap:7px}
.sc-switch{position:relative;width:24px;height:13px;border-radius:7px;background:var(--sc-rule-solid);transition:background .2s}
.sc-switch::after{content:'';position:absolute;top:2px;left:2px;width:9px;height:9px;border-radius:50%;background:var(--sc-paper);transition:transform .2s}
.sc-theme[aria-checked="true"]{color:var(--sc-ink)}
.sc-theme[aria-checked="true"] .sc-switch{background:var(--sc-accent)}
.sc-theme[aria-checked="true"] .sc-switch::after{transform:translateX(11px)}
@media (prefers-reduced-motion: reduce){.sc-switch,.sc-switch::after{transition:none}}
.sc-search{cursor:text;width:150px;letter-spacing:0}
.sc-search::placeholder{color:var(--sc-soft)}
.sc-spacer{flex:1}
.sc-menu{position:relative}
.sc-menu-list{position:absolute;right:0;top:calc(100% + 6px);z-index:5;display:none;flex-direction:column;min-width:150px;padding:4px;background:var(--sc-paper);border:1px solid var(--sc-rule-solid);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.08)}
.sc-menu.is-open .sc-menu-list{display:flex}
.sc-menu-list button{all:unset;cursor:pointer;font:400 12px/1 ${FONT.sans};color:var(--sc-ink);padding:8px 10px;border-radius:5px}
.sc-menu-list button:hover,.sc-menu-list button:focus-visible{background:var(--sc-paper-2)}
.sc-status{font:400 11px/1.4 ${FONT.mono};color:var(--sc-soft);min-height:16px;margin-top:8px}
.sc-node{cursor:pointer;outline:none;transition:filter .2s}
.sc-edge{transition:filter .2s}
.sc-node:focus-visible .n-box{stroke:var(--sc-accent);stroke-width:2}
.sc-svg.is-dim .sc-node:not(.is-lit):not(.is-past):not(.is-current):not(.is-future),.sc-svg.is-dim .sc-edge:not(.is-lit):not(.is-past):not(.is-current):not(.is-future),.sc-svg.is-dim .sc-dimmable:not(.is-lit){filter:opacity(.14)}
.sc-svg.is-dim .sc-groups,.sc-svg.is-dim .sc-legend,.sc-svg.is-dim .sc-lanes{filter:opacity(.45)}
.sc-svg.is-dim .e-token{display:none}
.sc-node.is-hit .n-box{stroke:var(--sc-accent);stroke-width:2}
.sc-edge.is-lit .e-line{stroke-width:1.8}
.sc-svg.sc-stepping [data-sc-step]{transition:filter .25s}
.sc-svg.sc-stepping [data-sc-step]:not(.is-shown){filter:opacity(.06)}
.sc-svg.sc-stepping .e-token{display:none}
.sc-mini{position:absolute;right:10px;bottom:10px;width:168px;background:var(--sc-paper);border:1px solid var(--sc-rule-solid);border-radius:6px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.08);cursor:pointer;z-index:4}
.sc-mini .sc-svg{max-height:120px;width:100%;transform:none!important}
.sc-mini-view{position:absolute;border:1.5px solid var(--sc-accent);background:var(--sc-accent-tint);border-radius:2px;pointer-events:none;margin:4px}
.sc-legend [data-sc-kind]:hover,.sc-legend [data-sc-ekind]:hover{opacity:.7}
.sc-svg.sc-cam{transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.sc-stage.is-picking .sc-node{cursor:crosshair}
.sc-svg.is-dim .sc-node.is-past,.sc-svg.is-dim .sc-edge.is-past{filter:opacity(.6)}
.sc-svg.is-dim .sc-node.is-future,.sc-svg.is-dim .sc-edge.is-future{filter:opacity(.32)}
.sc-svg.is-dim .sc-node[data-depth="2"]{filter:opacity(.82)}.sc-svg.is-dim .sc-node[data-depth="3"]{filter:opacity(.68)}.sc-svg.is-dim .sc-node[data-depth="4"]{filter:opacity(.56)}
.sc-node.is-current .n-box{stroke:var(--sc-accent);stroke-width:2.2;filter:drop-shadow(0 0 6px var(--sc-accent-tint))}
.sc-edge.is-current .e-line{stroke:var(--sc-accent);stroke-width:2}
.sc-comet{fill:none;stroke-width:3.2;stroke-linecap:round;stroke-dasharray:.1 .9;stroke-dashoffset:0;opacity:0;animation:sc-comet 1.15s linear both;pointer-events:none}
.sc-comet.c-out,.sc-comet.c-loop,.sc-comet.c-journey,.sc-comet.c-preview{stroke:var(--sc-accent)}
.sc-comet.c-in{stroke:var(--sc-link)}
.sc-comet.c-reach{stroke:var(--sc-accent);animation-duration:1.1s}
.sc-comet.c-journey{stroke-width:3.8;animation:sc-comet .78s cubic-bezier(.22,1,.36,1) both;filter:drop-shadow(0 0 4px var(--sc-accent))}
.sc-comet.is-static{animation:none;stroke-dasharray:none;opacity:.5}
@keyframes sc-comet{0%{opacity:.25;stroke-dashoffset:0}12%,78%{opacity:.95}100%{opacity:0;stroke-dashoffset:-1}}
.sc-ftok{offset-rotate:auto;offset-distance:0%;animation:sc-ftok 1.2s cubic-bezier(.2,0,.2,1) both;pointer-events:none}
@keyframes sc-ftok{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}
.sc-ftok .t-halo{fill:var(--sc-paper);stroke:var(--sc-accent);stroke-opacity:.35;stroke-width:1}
.sc-ftok .t-shape{fill:var(--sc-accent-tint);stroke:var(--sc-accent);stroke-width:1.1}
.sc-ftok .t-ink{fill:none;stroke:var(--sc-accent);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.sc-ftok .t-dot{fill:var(--sc-accent)}
@media (prefers-reduced-motion: reduce){.sc-comet{animation:none;stroke-dasharray:none;opacity:.5}.sc-ftok{display:none}.sc-svg.sc-cam{transition:none}}
.sc-panel{position:absolute;left:12px;top:12px;z-index:5;width:300px;max-height:calc(100% - 24px);overflow:auto;background:var(--sc-paper);border:1px solid var(--sc-rule-solid);border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.12);font-size:12px;animation:sc-panel-in .22s ease-out both}
@keyframes sc-panel-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.sc-p-head{position:relative;padding:14px 14px 12px;border-bottom:1px solid var(--sc-rule)}
.sc-p-eyebrow{font:500 9.5px/1 ${FONT.mono};letter-spacing:.18em;text-transform:uppercase;color:var(--sc-accent);margin-bottom:8px}
.sc-p-head h3{font:600 15px/1.25 ${FONT.sans};color:var(--sc-ink);padding-right:24px}
.sc-p-sub{font:400 11px/1.4 ${FONT.mono};color:var(--sc-muted);margin-top:3px}
.sc-p-x{all:unset;position:absolute;right:10px;top:8px;cursor:pointer;font-size:18px;line-height:1;color:var(--sc-soft);padding:4px 6px;border-radius:4px}
.sc-p-x:hover{color:var(--sc-ink);background:var(--sc-paper-2)}
.sc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}
.sc-chip{font:500 9.5px/1 ${FONT.mono};letter-spacing:.06em;color:var(--sc-muted);border:1px solid var(--sc-rule-solid);border-radius:999px;padding:4px 8px}
.sc-chip.is-kind{text-transform:uppercase;letter-spacing:.12em;color:var(--sc-ink);border-color:var(--sc-ink)}
.sc-chip.is-kind.k-focal,.sc-chip.is-kind.k-security{color:var(--sc-accent);border-color:var(--sc-accent)}
.sc-p-count{font:400 10.5px/1 ${FONT.mono};color:var(--sc-soft);margin-top:10px}
.sc-p-link{all:unset;cursor:pointer;position:absolute;right:14px;bottom:12px;font:500 10.5px/1 ${FONT.mono};color:var(--sc-accent)}
.sc-p-sec{padding:12px 14px;border-bottom:1px solid var(--sc-rule)}
.sc-p-sec:last-child{border-bottom:0}
.sc-p-sec h4{font:500 9px/1 ${FONT.mono};letter-spacing:.18em;text-transform:uppercase;color:var(--sc-muted);margin-bottom:8px}
.sc-reach{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sc-reach button{all:unset;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--sc-rule-solid);border-radius:6px;padding:8px 10px;color:var(--sc-ink);font:400 11.5px/1 ${FONT.sans}}
.sc-reach button b{font:600 12px/1 ${FONT.mono};color:var(--sc-accent)}
.sc-reach button:hover:not(:disabled),.sc-reach button[aria-pressed="true"]{border-color:var(--sc-accent);background:var(--sc-accent-tint)}
.sc-reach button:disabled{opacity:.45;cursor:default}
.sc-rel{all:unset;cursor:pointer;display:flex;gap:10px;align-items:flex-start;width:100%;box-sizing:border-box;padding:7px 6px;border-radius:6px}
.sc-rel:hover,.sc-rel:focus-visible{background:var(--sc-paper-2)}
.sc-rel-dir{font:600 9px/1.6 ${FONT.mono};letter-spacing:.08em;min-width:44px}
.sc-rel-dir.d-out,.sc-rel-dir.d-loop{color:var(--sc-accent)}.sc-rel-dir.d-in{color:var(--sc-link)}
.sc-rel-main b{display:block;font:600 12px/1.3 ${FONT.sans};color:var(--sc-ink)}
.sc-rel-main small{display:block;font:400 10.5px/1.35 ${FONT.mono};color:var(--sc-muted)}
.sc-src{padding:4px 0}.sc-src code{font:400 10.5px ${FONT.mono};color:var(--sc-ink)}.sc-src small{display:block;color:var(--sc-muted);font-size:10.5px}
.sc-j-controls{display:flex;gap:6px;padding:12px 14px;border-bottom:1px solid var(--sc-rule)}
.sc-j-controls button{all:unset;cursor:pointer;font:500 11px/1 ${FONT.mono};border:1px solid var(--sc-rule-solid);border-radius:6px;padding:7px 10px;color:var(--sc-muted)}
.sc-j-controls button.is-primary{color:var(--sc-accent);border-color:var(--sc-accent)}
.sc-j-controls button:hover:not(:disabled){color:var(--sc-ink);border-color:var(--sc-ink)}
.sc-j-controls button:disabled{opacity:.4;cursor:default}
.sc-j-steps{list-style:none;padding:8px 8px 10px;margin:0;counter-reset:s}
.sc-j-steps button{all:unset;cursor:pointer;display:grid;grid-template-columns:22px 1fr;column-gap:8px;width:100%;box-sizing:border-box;padding:6px;border-radius:6px;opacity:.75}
.sc-j-steps button span{grid-row:span 2;font:600 10px/20px ${FONT.mono};text-align:center;border-radius:50%;width:20px;height:20px;border:1px solid var(--sc-rule-solid);color:var(--sc-muted)}
.sc-j-steps button b{font:600 12px/1.3 ${FONT.sans};color:var(--sc-ink)}
.sc-j-steps button small{font:400 10.5px/1.3 ${FONT.mono};color:var(--sc-muted)}
.sc-j-steps button:hover{background:var(--sc-paper-2);opacity:1}
.sc-j-steps button.is-past{opacity:.6}
.sc-j-steps button.is-current{opacity:1;background:var(--sc-accent-tint)}
.sc-j-steps button.is-current span,.sc-j-steps button.is-past span{background:var(--sc-accent);border-color:var(--sc-accent);color:var(--sc-paper)}
.sc-lens .sc-menu-list{left:0;right:auto}
.sc-tip{position:absolute;pointer-events:none;z-index:6;background:var(--sc-ink);color:var(--sc-paper);font:500 11px/1.3 ${FONT.mono};padding:6px 8px;border-radius:5px;white-space:nowrap;opacity:0;transition:opacity .12s}
.sc-tip.is-on{opacity:1}
/* a canvas the reader sized (grip) or full screen: the diagram fills it */
.sc-stage.is-sized .sc-svg,.sc-full .sc-svg{width:100%;height:100%;max-height:none}
.sc-grip{height:14px;margin-top:2px;cursor:ns-resize;display:flex;align-items:center;justify-content:center;touch-action:none;border-radius:4px}
.sc-grip::before{content:'';width:44px;height:4px;border-radius:2px;background:var(--sc-rule-solid);transition:background .15s,width .15s}
.sc-grip:hover::before,.sc-grip:focus-visible::before,.sc-grip.is-dragging::before{background:var(--sc-accent);width:64px}
.sc-grip:focus-visible{outline:none}
.sc-page.sc-full{position:fixed;inset:0;z-index:1000;max-width:none;width:auto;height:100%;display:flex;flex-direction:column;padding:14px 18px;background:var(--sc-paper);overflow:hidden}
.sc-full .sc-head,.sc-full .sc-grip,.sc-full .sc-evidence,.sc-full .sc-caption{display:none}
.sc-full .sc-bar{flex:none}
.sc-full .sc-figure{flex:1;min-height:0;display:flex}
.sc-full .sc-stage{flex:1;height:auto!important}
.sc-full .sc-status{flex:none;min-height:0}
body.sc-embed{padding:12px;min-height:0}.sc-embed .sc-head,.sc-embed .sc-bar,.sc-embed .sc-status,.sc-embed .sc-evidence,.sc-embed .sc-grip{display:none}
@media (max-width:760px){.sc-panel{position:static;width:auto;max-height:none;margin:10px 0 0;box-shadow:none}}
@media (max-width:640px){body{padding:28px 16px}.sc-search{width:110px}}
@media print{.sc-bar,.sc-status,.sc-grip{display:none}body{padding:0}}
`;
