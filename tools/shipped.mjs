// The files a release ships: what git tracks plus new files it doesn't
// ignore, so local clutter (.repos/ reference clones, .DS_Store, temp files)
// never reaches the zip or an install. Outside a git checkout (a downloaded
// archive) it falls back to walking the folder.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(dir).sort().flatMap((f) => {
    if (f === '.DS_Store' || f.startsWith('.tmp')) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Repo-relative paths (forward slashes, sorted) of shipped files under `sub`.
export function shippedFiles(sub = '.') {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', sub], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) {
    return r.stdout.split('\0').filter(Boolean)
      .filter((p) => { try { return statSync(join(ROOT, p)).isFile(); } catch { return false; } }) // deleted but still tracked
      .sort();
  }
  return walk(join(ROOT, sub)).map((p) => relative(ROOT, p).split('\\').join('/')).sort();
}

// Copies the shipped files of the whole repo into `dest`: a clean stand-in
// for what `npx skills add <owner>/<repo>` fetches from GitHub.
export function stageShipped(dest) {
  for (const p of shippedFiles('.')) {
    const to = join(dest, p);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(ROOT, p), to);
  }
  return dest;
}
