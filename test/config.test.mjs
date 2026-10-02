import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let home, proj, config;
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'sc-home-'));
  proj = mkdtempSync(join(tmpdir(), 'sc-proj-'));
  mkdirSync(join(proj, '.git'));
  process.env.SEECODE_HOME = home;
  config = await import('../skills/seecode/scripts/lib/config/config.mjs');
});

test('first run is detected, then never again', () => {
  assert.equal(config.status(proj).state, 'first-run');
  config.init(proj, 'global');
  assert.equal(config.status(proj).state, 'inherits-global');
  assert.deepEqual(JSON.parse(readFileSync(join(proj, '.seecode/config.json'), 'utf8')), { inherit: 'global' });
});

test('project settings override global, global overrides defaults', () => {
  config.init(proj, 'global');
  config.set(proj, 'fps', '24', { global: true });
  assert.equal(config.status(proj).settings.fps, 24);
  config.set(proj, 'fps', '12');
  const s = config.status(proj);
  assert.equal(s.state, 'project');
  assert.equal(s.settings.fps, 12);
  assert.equal(s.settings.skin, 'light');
});

test('list values and unknown keys', () => {
  config.init(proj, 'project');
  assert.deepEqual(config.set(proj, 'exportFormats', 'html,gif').settings.exportFormats, ['html', 'gif']);
  assert.throws(() => config.set(proj, 'colour', 'red'), /unknown setting/);
});
