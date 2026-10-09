// Example specs live in examples/specs/<family>/<name>.json: one per type
// (named after it), plus everyday examples with their own names.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXAMPLES = fileURLToPath(new URL('../examples/', import.meta.url));
export const FAMILIES = { systems: 'Systems', process: 'Process & time', 'data-platform': 'Data platform', structure: 'Structure', charts: 'Charts', everyday: 'Everyday' };

export function exampleSpecs() {
  const dir = join(EXAMPLES, 'specs');
  return Object.keys(FAMILIES).flatMap((family) =>
    readdirSync(join(dir, family)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ family, type: f.replace(/\.json$/, ''), path: join(dir, family, f) })),
  );
}
