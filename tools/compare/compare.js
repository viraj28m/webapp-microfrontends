#!/usr/bin/env node
/**
 * Compares two snapshots produced by `capture.sh` and prints a report.
 *
 * Usage: node tools/compare/compare.js <baselineDir> <candidateDir> [--threshold 0.02]
 *
 * Exit code 1 if any inventory / behavioural difference is found. Pixel diffs
 * above the threshold are reported but do not fail the run by themselves,
 * because visual changes are an expected outcome of the Material MDC migration
 * and must be reviewed by a human via the generated *.diff.png images.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const [baselineDir, candidateDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!baselineDir || !candidateDir) {
  console.error('usage: compare.js <baselineDir> <candidateDir> [--threshold 0.02]');
  process.exit(2);
}
const tIdx = process.argv.indexOf('--threshold');
const threshold = tIdx >= 0 ? Number(process.argv[tIdx + 1]) : 0.02;

const load = (dir, name) => {
  const p = path.join(dir, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

let behaviouralDiffs = 0;
const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

function diffValue(label, a, b) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja === jb) return;
  behaviouralDiffs++;
  if (Array.isArray(a) && Array.isArray(b)) {
    const sa = new Set(a.map((x) => JSON.stringify(x)));
    const sb = new Set(b.map((x) => JSON.stringify(x)));
    const removed = [...sa].filter((x) => !sb.has(x));
    const added = [...sb].filter((x) => !sa.has(x));
    say(`  ✗ ${label}`);
    removed.slice(0, 20).forEach((x) => say(`      - ${x}`));
    added.slice(0, 20).forEach((x) => say(`      + ${x}`));
    if (removed.length + added.length > 40) say(`      … ${removed.length + added.length - 40} more`);
  } else {
    say(`  ✗ ${label}`);
    say(`      - ${ja.slice(0, 300)}`);
    say(`      + ${jb.slice(0, 300)}`);
  }
}

// ---- static inventory -----------------------------------------------------
say('== Static inventory ==');
const invA = load(baselineDir, 'inventory.json');
const invB = load(candidateDir, 'inventory.json');
if (invA && invB) {
  for (const project of Object.keys(invA.projects)) {
    for (const key of ['components', 'directives', 'pipes', 'modules', 'injectables']) {
      diffValue(`${project}.${key}`, invA.projects[project][key], (invB.projects[project] || {})[key]);
    }
  }
  diffValue('routes', invA.routes, invB.routes);
  diffValue('translationKeys', invA.translationKeys, invB.translationKeys);
  diffValue('publicApi', invA.publicApi, invB.publicApi);
} else {
  say('  (inventory.json missing on one side, skipped)');
}

// ---- build / test results -------------------------------------------------
say('== Build & test ==');
const buildA = load(baselineDir, 'build.json');
const buildB = load(candidateDir, 'build.json');
if (buildA && buildB) {
  for (const k of Object.keys({ ...buildA, ...buildB })) {
    const a = buildA[k] || {};
    const b = buildB[k] || {};
    const mark = a.status === b.status ? '·' : b.status === 'ok' ? '↑' : '✗';
    if (mark === '✗') behaviouralDiffs++;
    say(`  ${mark} ${k}: ${a.status || 'n/a'} → ${b.status || 'n/a'}${b.summary ? `  (${b.summary})` : ''}`);
  }
}

// ---- runtime behaviour ----------------------------------------------------
say('== Runtime behaviour ==');
const rtA = load(baselineDir, 'runtime.json');
const rtB = load(candidateDir, 'runtime.json');
const behaviourKeys = [
  'title',
  'hash',
  'headings',
  'buttons',
  'labels',
  'links',
  'errors',
  'inputs',
  'disabledButtons',
  'checkboxes',
  'passwordInputType',
  'credentialsStored',
  'sidenavItems',
  'apiCalls'
];
if (rtA && rtB) {
  for (const name of Object.keys(rtA.scenarios)) {
    const a = rtA.scenarios[name];
    const b = rtB.scenarios[name];
    if (!b) {
      behaviouralDiffs++;
      say(`  ✗ scenario ${name} missing in candidate`);
      continue;
    }
    const before = behaviouralDiffs;
    for (const k of behaviourKeys) {
      if (k in a || k in b) diffValue(`${name}.${k}`, a[k], b[k]);
    }
    if (a.bodyText !== b.bodyText) {
      say(`  ~ ${name}.bodyText differs (informational)`);
    }
    const errA = a.consoleErrors.length;
    const errB = b.consoleErrors.length;
    if (errB > errA) {
      behaviouralDiffs++;
      say(`  ✗ ${name}.consoleErrors ${errA} → ${errB}`);
      b.consoleErrors.slice(0, 5).forEach((e) => say(`      + ${e}`));
    }
    if (behaviouralDiffs === before) say(`  ✓ ${name}`);
  }
  for (const f of rtB.meta.failures || []) {
    behaviouralDiffs++;
    say(`  ✗ candidate scenario failed: ${f.name}: ${f.error}`);
  }
}

// ---- screenshots ----------------------------------------------------------
say('== Screenshots (pixel diff) ==');
const pngs = fs.existsSync(baselineDir) ? fs.readdirSync(baselineDir).filter((f) => f.endsWith('.png') && !f.includes('.diff.') && !f.includes('.failed.')) : [];
for (const f of pngs) {
  const pb = path.join(candidateDir, f);
  if (!fs.existsSync(pb)) {
    say(`  ✗ ${f}: missing in candidate`);
    continue;
  }
  const a = PNG.sync.read(fs.readFileSync(path.join(baselineDir, f)));
  const b = PNG.sync.read(fs.readFileSync(pb));
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const pad = (img) => {
    if (img.width === width && img.height === height) return img.data;
    const out = new PNG({ width, height });
    out.data.fill(0);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out.data;
  };
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(pad(a), pad(b), diff.data, width, height, { threshold: 0.1 });
  const ratio = mismatched / (width * height);
  const sizeNote = a.width !== b.width || a.height !== b.height ? ` size ${a.width}x${a.height} → ${b.width}x${b.height}` : '';
  if (ratio > threshold) {
    fs.writeFileSync(path.join(candidateDir, f.replace('.png', '.diff.png')), PNG.sync.write(diff));
    say(`  ~ ${f}: ${(ratio * 100).toFixed(2)}% pixels differ${sizeNote} → ${f.replace('.png', '.diff.png')}`);
  } else {
    say(`  ✓ ${f}: ${(ratio * 100).toFixed(2)}% pixels differ${sizeNote}`);
  }
}

say('');
say(behaviouralDiffs ? `${behaviouralDiffs} behavioural difference(s) found` : 'No behavioural differences');
fs.writeFileSync(path.join(candidateDir, 'compare-report.txt'), lines.join('\n') + '\n');
process.exit(behaviouralDiffs ? 1 : 0);
