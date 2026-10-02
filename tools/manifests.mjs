// Every file that carries the release version. package.json is the source of truth.
export const VERSIONED = [
  ['package.json', ['version']],
  ['.claude-plugin/plugin.json', ['version']],
  ['.claude-plugin/marketplace.json', ['plugins', 0, 'version']],
  ['.codex-plugin/plugin.json', ['version']],
  ['.factory-plugin/plugin.json', ['version']],
];
export const get = (obj, path) => path.reduce((o, k) => o?.[k], obj);
export function set(obj, path, v) {
  const last = path[path.length - 1];
  path.slice(0, -1).reduce((o, k) => o[k], obj)[last] = v;
}
