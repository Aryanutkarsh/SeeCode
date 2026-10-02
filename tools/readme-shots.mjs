// Renders every example spec and exports the README screenshots:
// docs/screenshots/<type>.png (full size, content-aware scale) and
// docs/screenshots/gifs/<type>.gif (the animated build-up, for the README grid).
import { mkdirSync, writeFileSync, renameSync, rmSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderSpec } from '../skills/seecode/scripts/lib/render.mjs';
import { exportDiagram } from '../skills/seecode/scripts/lib/export/export.mjs';
import { exampleSpecs } from './examples.mjs';

const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(join(OUT, 'gifs'), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'sc-shots-'));
const only = process.argv.slice(2);
try {
  for (const ex of exampleSpecs().filter((e) => !only.length || only.includes(e.type))) {
    const html = join(tmp, `${ex.type}.html`);
    writeFileSync(html, renderSpec(JSON.parse(readFileSync(ex.path, 'utf8'))).html);
    const full = await exportDiagram(html, { formats: 'png' });
    if (!full.ok) throw new Error(`${ex.type}: ${full.error}`);
    renameSync(join(tmp, `${ex.type}.png`), join(OUT, `${ex.type}.png`));
    // grid cells show ~300 px, so 600 px keeps them sharp on high-DPI screens
    const gif = await exportDiagram(html, { formats: 'gif', 'gif-width': 600, fps: 12 });
    if (!gif.ok) throw new Error(`${ex.type}: ${gif.error || gif.warnings}`);
    renameSync(join(tmp, `${ex.type}.gif`), join(OUT, 'gifs', `${ex.type}.gif`));
    process.stdout.write(`${ex.type} `);
  }
  process.stdout.write('\n');
  // the README's theme row: default light, default dark, and a learned brand
  if (!only.length || only.includes('themes')) {
    const { learnBrand } = await import('../skills/seecode/scripts/lib/brand/brand.mjs');
    const learned = await learnBrand(null, { colors: '#D4A574,#E7E5E2,#1E1C1A' });
    const spec = JSON.parse(readFileSync(fileURLToPath(new URL('../examples/specs/systems/architecture.json', import.meta.url)), 'utf8'));
    const THEMES = fileURLToPath(new URL('../docs/themes/', import.meta.url));
    mkdirSync(THEMES, { recursive: true });
    for (const [name, theme, settings] of [['light', 'light', {}], ['dark', 'dark', {}], ['brand', 'dark', { brand: { ...learned.light, dark: learned.dark } }]]) {
      const html = join(tmp, `theme-${name}.html`);
      writeFileSync(html, renderSpec(spec, { settings }).html);
      const r = await exportDiagram(html, { formats: 'gif', 'gif-width': 600, fps: 12, theme });
      if (!r.ok) throw new Error(`theme ${name}: ${r.error}`);
      renameSync(join(tmp, `theme-${name}.gif`), join(THEMES, `${name}.gif`));
    }
    process.stdout.write('themes: light dark brand\n');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
