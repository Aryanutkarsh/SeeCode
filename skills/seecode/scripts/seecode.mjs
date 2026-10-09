#!/usr/bin/env node
// SeeCode skill entrypoint. Every command prints ONE line of JSON so the
// calling agent spends as few tokens as possible reading results.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderSpec, outPathFor, writeAtomic, summarize, mergePatch, compactJson } from './lib/render.mjs';
import { TYPES } from './lib/types.mjs';
import * as config from './lib/config/config.mjs';

const [cmd, ...rest] = process.argv.slice(2);

function args(list) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) flags[k] = v;
      else if (list[i + 1] !== undefined && !list[i + 1].startsWith('--')) flags[k] = list[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function fail(msg, fix) {
  print({ ok: false, error: msg, ...(fix ? { fix } : {}) });
  process.exit(1);
}

function readSpec(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`cannot read spec ${path}: ${e.message.split('\n')[0]}`, 'write valid JSON (no comments, no trailing commas)');
  }
}

const { pos, flags } = args(rest);

switch (cmd) {
  case 'render':
  case 'validate': {
    if (!pos[0]) fail('usage: seecode.mjs render <spec.json | folder> [--patch <json>] [--motion <preset>]');
    const { isDir, renderFolder } = await import('./lib/folder.mjs');
    if (cmd === 'render' && isDir(resolve(pos[0]))) {
      if (flags.patch) fail('--patch takes one spec file, not a folder');
      const r = renderFolder(resolve(pos[0]), { motion: flags.motion });
      print(r);
      if (!r.ok) process.exit(1);
      break;
    }
    const specPath = resolve(pos[0]);
    let spec = readSpec(specPath);
    if (flags.patch) {
      let patch;
      try { patch = JSON.parse(flags.patch); } catch (e) { fail(`bad --patch JSON: ${e.message}`); }
      spec = mergePatch(spec, patch);
      writeFileSync(specPath, `${compactJson(spec)}\n`);
    }
    if (flags.motion) spec.motion = flags.motion;
    const settings = config.status(specPath.replace(/[^/\\]+$/, '')).settings;
    const r = renderSpec(spec, { specPath, settings });
    if (!r.ok) {
      print(summarize(r));
      process.exit(1);
    }
    let out;
    if (cmd === 'render') {
      out = flags.out ? resolve(flags.out) : outPathFor(spec, specPath, settings);
      writeAtomic(out, r.html);
    }
    print(summarize(r, out));
    break;
  }
  case 'types': {
    const fams = {};
    for (const [slug, t] of Object.entries(TYPES)) (fams[t.family] = fams[t.family] || []).push(slug);
    print({ ok: true, types: fams });
    break;
  }
  case 'config': {
    const sub = pos[0] || 'status';
    const cwd = flags.cwd ? resolve(flags.cwd) : process.cwd();
    try {
      if (sub === 'status') {
        const s = config.status(cwd);
        print({ ok: true, ...s, ...(s.state === 'first-run' ? { ask: 'First SeeCode run in this project: use global settings, or create project settings?', then: 'config init --use global|project' } : {}) });
      } else if (sub === 'init') {
        if (!['global', 'project'].includes(flags.use)) fail('init needs --use global|project');
        print({ ok: true, ...config.init(cwd, flags.use) });
      } else if (sub === 'set') {
        if (pos.length < 3) fail('usage: config set <key> <value> [--global]');
        print({ ok: true, ...config.set(cwd, pos[1], pos[2], { global: !!flags.global }) });
      } else if (sub === 'profile') {
        const action = pos[1] || 'list';
        if (action === 'list') print({ ok: true, profiles: config.listProfiles() });
        else if (action === 'save') {
          if (!pos[2]) fail('usage: config profile save <slug> --accent #hex [--link #hex --paper #hex --ink #hex --muted #hex] [--use]');
          const saved = config.saveProfile(pos[2], flags);
          if (flags.use) config.set(cwd, 'profile', pos[2], { global: flags.global === true });
          print({ ok: true, ...saved, ...(flags.use ? { using: true } : {}) });
        } else fail(`unknown profile action "${action}"`, 'use list | save');
      } else fail(`unknown config command "${sub}"`, 'use status | init | set | profile');
    } catch (e) {
      fail(e.message);
    }
    break;
  }
  case 'brand': {
    const { learnBrand } = await import('./lib/brand/brand.mjs');
    const learned = await learnBrand(pos[0] && !/^https?:/i.test(pos[0]) ? resolve(pos[0]) : pos[0], { colors: flags.colors, fonts: flags.fonts });
    if (!learned.ok || !flags.save) {
      print(learned.ok ? { ...learned, next: `brand ${pos[0] ? pos[0] : `--colors "${flags.colors}"`} --save <name> --use` } : learned);
      if (!learned.ok) process.exit(1);
      break;
    }
    try {
      const saved = config.saveProfile(String(flags.save), learned.light, { dark: learned.dark, fonts: learned.fonts, source: pos[0] || 'colour list' });
      const cwd = flags.cwd ? resolve(flags.cwd) : process.cwd();
      if (flags.use) config.set(cwd, 'profile', String(flags.save), { global: flags.global === true });
      print({ ...learned, saved: saved.file, ...(flags.use ? { using: String(flags.save) } : {}) });
    } catch (e) {
      fail(e.message);
    }
    break;
  }
  case 'scan': {
    const { scanRepo } = await import('./lib/scan/scan.mjs');
    print(scanRepo(resolve(pos[0] || '.'), { depth: Number(flags.depth || 2) }));
    break;
  }
  case 'export': {
    const { exportDiagram } = await import('./lib/export/export.mjs');
    if (!pos[0]) fail('usage: seecode.mjs export <diagram.html | folder> [--for pdf|docs|word|gdocs|notion|confluence|readme|slides|gslides|figma|social|video|animated] [--formats png,svg,gif,mp4] [--zip]');
    const { isDir, exportFolder } = await import('./lib/folder.mjs');
    if (isDir(resolve(pos[0]))) {
      const r = await exportFolder(resolve(pos[0]), flags, exportDiagram);
      print(r);
      if (!r.ok) process.exit(1);
      break;
    }
    print(await exportDiagram(resolve(pos[0]), flags));
    break;
  }
  case 'import': {
    const { importFile } = await import('./lib/importers/import.mjs');
    if (!pos[0]) fail('usage: seecode.mjs import <file> [--block N] [--all] [--out <path>]');
    print(importFile(resolve(pos[0]), flags));
    break;
  }
  case 'doctor': {
    const { doctor } = await import('./lib/export/doctor.mjs');
    print(await doctor());
    break;
  }
  default:
    print({ ok: false, error: `unknown command "${cmd || ''}"`, commands: ['render', 'validate', 'types', 'config', 'brand', 'scan', 'import', 'export', 'doctor'] });
    process.exit(1);
}
