#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Compare two parity runs:
 *   node scripts/compare.js angular14 angular18
 *
 * Reads results/<label>/parity-report.json for both, diffs flow status and
 * recorded facts, and pixel-diffs any screenshot present in both runs.
 * Writes results/compare-<a>-vs-<b>/{report.md,report.json,diffs/*.png}.
 * Exits 1 if any flow status or fact differs (screenshot drift is reported
 * but is not a failure by itself: CSS/framework upgrades legitimately move
 * pixels; the human decides).
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('usage: node scripts/compare.js <runLabelA> <runLabelB>');
  process.exit(2);
}
const root = path.join(__dirname, '..', 'results');
const load = (l) => JSON.parse(fs.readFileSync(path.join(root, l, 'parity-report.json'), 'utf8'));
const A = load(a);
const B = load(b);
const outDir = path.join(root, `compare-${a}-vs-${b}`);
fs.mkdirSync(path.join(outDir, 'diffs'), { recursive: true });

const byFlow = (r) => Object.fromEntries(r.flows.map((f) => [f.flow, f]));
const fa = byFlow(A);
const fb = byFlow(B);
const flows = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort();

const result = { a: A.runLabel, b: B.runLabel, baseUrlA: A.baseUrl, baseUrlB: B.baseUrl, flows: [] };
let behaviourDiffs = 0;

for (const name of flows) {
  const x = fa[name];
  const y = fb[name];
  const entry = { flow: name, statusA: x?.status ?? 'missing', statusB: y?.status ?? 'missing', facts: [], screenshots: [] };
  if (entry.statusA !== entry.statusB) behaviourDiffs++;

  const factsA = Object.fromEntries((x?.facts ?? []).map((f) => [f.key, f.value]));
  const factsB = Object.fromEntries((y?.facts ?? []).map((f) => [f.key, f.value]));
  for (const key of [...new Set([...Object.keys(factsA), ...Object.keys(factsB)])].sort()) {
    const same = String(factsA[key]) === String(factsB[key]);
    if (!same) behaviourDiffs++;
    entry.facts.push({ key, a: factsA[key], b: factsB[key], same });
  }

  const shotsA = new Map((x?.checkpoints ?? []).map((c) => [c.name, c.file]));
  const shotsB = new Map((y?.checkpoints ?? []).map((c) => [c.name, c.file]));
  for (const cp of [...new Set([...shotsA.keys(), ...shotsB.keys()])]) {
    const pa = shotsA.has(cp) ? path.join(root, a, 'screenshots', shotsA.get(cp)) : null;
    const pb = shotsB.has(cp) ? path.join(root, b, 'screenshots', shotsB.get(cp)) : null;
    if (!pa || !pb || !fs.existsSync(pa) || !fs.existsSync(pb)) {
      entry.screenshots.push({ checkpoint: cp, status: 'missing-in-one-run', a: pa && path.relative(root, pa), b: pb && path.relative(root, pb) });
      continue;
    }
    const img1 = PNG.sync.read(fs.readFileSync(pa));
    const img2 = PNG.sync.read(fs.readFileSync(pb));
    if (img1.width !== img2.width || img1.height !== img2.height) {
      entry.screenshots.push({ checkpoint: cp, status: 'size-mismatch', a: `${img1.width}x${img1.height}`, b: `${img2.width}x${img2.height}` });
      continue;
    }
    const diff = new PNG({ width: img1.width, height: img1.height });
    const changed = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, { threshold: 0.1 });
    const pct = (100 * changed) / (img1.width * img1.height);
    const diffFile = path.join('diffs', shotsA.get(cp));
    if (changed > 0) fs.writeFileSync(path.join(outDir, diffFile), PNG.sync.write(diff));
    entry.screenshots.push({ checkpoint: cp, status: changed === 0 ? 'identical' : 'differs', changedPixels: changed, changedPct: +pct.toFixed(2), diff: changed ? diffFile : null });
  }
  result.flows.push(entry);
}
result.behaviourDiffs = behaviourDiffs;

const md = [];
md.push(`# Parity comparison: ${A.runLabel} vs ${B.runLabel}`, '');
md.push(`- A: **${A.runLabel}** @ ${A.baseUrl}${A.appVersion ? ` (app ${A.appVersion})` : ''}`);
md.push(`- B: **${B.runLabel}** @ ${B.baseUrl}${B.appVersion ? ` (app ${B.appVersion})` : ''}`);
md.push(`- Behavioural differences (status or facts): **${behaviourDiffs}**`, '');
md.push('## Flow status', '', `| Flow | ${A.runLabel} | ${B.runLabel} | Same |`, '|---|---|---|---|');
for (const f of result.flows) md.push(`| ${f.flow} | ${f.statusA} | ${f.statusB} | ${f.statusA === f.statusB ? 'yes' : '**NO**'} |`);
md.push('', '## Facts', '', `| Flow | Fact | ${A.runLabel} | ${B.runLabel} | Same |`, '|---|---|---|---|---|');
for (const f of result.flows) for (const k of f.facts) md.push(`| ${f.flow} | ${k.key} | ${k.a ?? '—'} | ${k.b ?? '—'} | ${k.same ? 'yes' : '**NO**'} |`);
md.push('', '## Screenshots', '', '| Flow | Checkpoint | Result | Changed px | Diff |', '|---|---|---|---|---|');
for (const f of result.flows) for (const s of f.screenshots) md.push(`| ${f.flow} | ${s.checkpoint} | ${s.status} | ${s.changedPixels ?? ''}${s.changedPct != null ? ` (${s.changedPct}%)` : ''} | ${s.diff ?? ''} |`);
md.push('');

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));
console.log(md.join('\n'));
console.log(`Written to ${path.relative(process.cwd(), outDir)}/`);
process.exit(behaviourDiffs ? 1 : 0);
