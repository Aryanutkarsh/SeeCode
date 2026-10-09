// Small line icons for nodes (`"icon": "calendar"`), drawn on a 24-unit grid
// with round strokes. Decorative: hidden from assistive tech, and they never
// change a node's kind or colour. Everyday subjects first, then technical.
import { el } from '../../svg.mjs';

const P = (d) => ['path', { d }];
const C = (cx, cy, r) => ['circle', { cx, cy, r }];
const R = (x, y, width, height, rx = 2) => ['rect', { x, y, width, height, rx }];

export const ICONS = {
  calendar: [R(3, 5, 18, 16), P('M3 10h18M8 3v4M16 3v4')],
  clock: [C(12, 12, 9), P('M12 7v5l3 2')],
  person: [C(12, 8, 4), P('M4 21c0-4 3.6-6 8-6s8 2 8 6')],
  people: [C(9, 8, 3.5), C(17, 9, 2.5), P('M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16.5 14.5c3 0 5.5 1.6 5.5 4.5')],
  briefcase: [R(3, 7, 18, 13), P('M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18')],
  home: [P('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z')],
  money: [R(2, 6, 20, 12), C(12, 12, 3), P('M6 9v.01M18 15v.01')],
  card: [R(2, 5, 20, 14), P('M2 10h20M6 15h4')],
  cart: [P('M3 4h2l2.5 11h11L21 8H7'), C(9, 19.5, 1.5), C(17, 19.5, 1.5)],
  document: [P('M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7')],
  flag: [P('M5 21V4h12l-2 4 2 4H5')],
  check: [C(12, 12, 9), P('M8 12.5l3 3 5-6')],
  mail: [R(3, 5, 18, 14), P('M3 7l9 6 9-6')],
  phone: [R(7, 2, 10, 20), P('M11 18h2')],
  chat: [P('M4 5h16v11H9l-5 4z')],
  plane: [P('M22 2L11 13M22 2l-7 20-4-9-9-4z')],
  car: [P('M5 15l1.6-4.7A2 2 0 0 1 8.5 9h7a2 2 0 0 1 1.9 1.3L19 15'), R(3, 15, 18, 4, 1), C(7.5, 19.5, 1.5), C(16.5, 19.5, 1.5)],
  heart: [P('M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z')],
  star: [P('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z')],
  moon: [P('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z')],
  sun: [C(12, 12, 4), P('M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')],
  gift: [R(3, 8, 18, 4, 1), R(5, 12, 14, 9, 1), P('M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zM12 8c2-4 6-4 6-1.5S14 8 12 8z')],
  pin: [P('M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z'), C(12, 9.5, 2.5)],
  key: [C(8, 15, 4), P('M11 12l9-9M16 7l3 3')],
  server: [R(3, 4, 18, 7, 1.5), R(3, 13, 18, 7, 1.5), P('M7 7.5v.01M7 16.5v.01')],
  database: [['ellipse', { cx: 12, cy: 6, rx: 8, ry: 3 }], P('M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3')],
  cloud: [P('M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z')],
  lock: [R(5, 11, 14, 10), P('M8 11V7a4 4 0 0 1 8 0v4')],
  code: [P('M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16')],
  gear: [C(12, 12, 3), P('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1')],
};

export const ICON_NAMES = Object.keys(ICONS);
export const ICON_SIZE = 14;
// Horizontal room a node reserves for an icon left of its label.
export const ICON_ROOM = 20;
// Shapes that have room for an icon beside the label.
export const ICON_SHAPES = new Set(['box', 'state', 'terminal', 'io']);
export const hasIcon = (n) => Boolean(n.icon && ICONS[n.icon] && ICON_SHAPES.has(n.shape || 'box'));

// The icon drawn at (x, y), its top-left corner.
export function drawIcon(name, x, y) {
  const s = ICON_SIZE / 24;
  return el('g', { class: 'n-icon', transform: `translate(${x} ${y}) scale(${s})`, 'aria-hidden': 'true' },
    ICONS[name].map(([tag, attrs]) => el(tag, attrs)));
}
