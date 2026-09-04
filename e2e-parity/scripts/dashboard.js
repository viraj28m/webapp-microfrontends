#!/usr/bin/env node
/**
 * Renders a self-contained HTML dashboard from two parity runs (and their
 * comparison, when present):
 *
 *   node scripts/dashboard.js angular14 angular18
 *   -> results/index.html
 *
 * Screenshots are referenced relative to results/, so serve that directory
 * with any static server (e.g. `npx http-server results`).
 */
const fs = require('fs');
const path = require('path');

const RESULTS = path.join(__dirname, '..', 'results');

const [labelA = 'angular14', labelB = 'angular18'] = process.argv.slice(2);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadRun(label) {
  const report = readJson(path.join(RESULTS, label, 'parity-report.json'));
  return { label, ...report };
}

function esc(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function duration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusPill(summary) {
  const ok = summary.failed === 0 && summary.passed === summary.total;
  return `<span class="pill ${ok ? 'pass' : 'fail'}">${summary.passed}/${summary.total} passed</span>`;
}

function runSection(run) {
  const flows = [...run.flows].sort((a, b) => a.flow.localeCompare(b.flow));
  return `
  <section class="run">
    <h2>${esc(run.label)} ${statusPill(run.summary)}</h2>
    <p class="meta">${esc(run.baseUrl)} &middot; ${esc(new Date(run.startedAt).toISOString())} &middot; ${run.summary.failed} failed, ${run.summary.skipped} skipped</p>
    ${flows.map((flow) => flowCard(run, flow)).join('')}
  </section>`;
}

function flowCard(run, flow) {
  const facts = (flow.facts ?? []).map((f) => `<tr><td>${esc(f.key)}</td><td>${esc(f.value)}</td></tr>`).join('');
  const shots = (flow.checkpoints ?? [])
    .map(
      (cp) => `<figure>
        <a href="${esc(run.label)}/screenshots/${esc(cp.file)}" target="_blank" rel="noreferrer">
          <img loading="lazy" src="${esc(run.label)}/screenshots/${esc(cp.file)}" alt="${esc(cp.name)}">
        </a>
        <figcaption>${esc(cp.name)}${cp.route ? ` <code>${esc(cp.route)}</code>` : ''}</figcaption>
      </figure>`
    )
    .join('');
  return `
  <details class="flow ${flow.status}" ${flow.status === 'passed' ? '' : 'open'}>
    <summary>
      <span class="status ${flow.status}">${flow.status === 'passed' ? 'PASS' : flow.status.toUpperCase()}</span>
      <span class="flow-name">${esc(flow.flow)}</span>
      <span class="flow-meta">${esc(flow.file)} &middot; ${duration(flow.durationMs)}</span>
    </summary>
    ${flow.error ? `<pre class="error">${esc(flow.error)}</pre>` : ''}
    ${facts ? `<table class="facts"><thead><tr><th>Fact</th><th>Value</th></tr></thead><tbody>${facts}</tbody></table>` : ''}
    ${shots ? `<div class="shots">${shots}</div>` : ''}
  </details>`;
}

function comparisonSection(compare) {
  if (!compare) return '';
  const facts = compare.flows.flatMap((flow) => flow.facts.map((f) => ({ flow: flow.flow, ...f })));
  const diffCount = compare.behaviourDiffs ?? facts.filter((f) => !f.same).length;
  const rows = facts
    .map(
      (f) => `<tr class="${f.same ? '' : 'diff'}">
        <td>${esc(f.flow)}</td><td>${esc(f.key)}</td>
        <td>${esc(f.a ?? '—')}</td><td>${esc(f.b ?? '—')}</td>
        <td>${f.same ? 'same' : 'DIFFERENT'}</td>
      </tr>`
    )
    .join('');
  return `
  <section class="run">
    <h2>Behavioural comparison <span class="pill ${diffCount === 0 ? 'pass' : 'fail'}">${diffCount} differences</span></h2>
    <p class="meta">Route + on-screen facts captured by each run, compared key by key. Screenshot pixel diffs are informational and live in <code>results/compare-${esc(labelA)}-vs-${esc(labelB)}/</code>.</p>
    <table class="facts">
      <thead><tr><th>Flow</th><th>Fact</th><th>${esc(labelA)}</th><th>${esc(labelB)}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

const runA = loadRun(labelA);
const runB = loadRun(labelB);

const comparePath = path.join(RESULTS, `compare-${labelA}-vs-${labelB}`, 'report.json');
const compare = fs.existsSync(comparePath) ? readJson(comparePath) : null;

const allGreen = [runA, runB].every((r) => r.summary.failed === 0 && r.summary.passed === r.summary.total);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parity suite: ${esc(labelA)} vs ${esc(labelB)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 2rem clamp(1rem, 4vw, 3rem); font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: #17222c; background: #f4f6f8; }
  h1 { margin: 0 0 .25rem; font-size: 1.6rem; }
  h2 { font-size: 1.15rem; display: flex; align-items: center; gap: .6rem; margin: 0 0 .25rem; }
  .meta { color: #5b6b7a; margin: .25rem 0 1rem; font-size: .875rem; }
  .banner { display: inline-flex; align-items: center; gap: .5rem; padding: .5rem .9rem; border-radius: 6px; font-weight: 600;
            background: ${allGreen ? '#e5f6ec' : '#fdecec'}; color: ${allGreen ? '#136c37' : '#a01414'}; margin-bottom: 1.5rem; }
  .runs { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(430px, 1fr)); align-items: start; }
  .run { background: #fff; border: 1px solid #dfe4ea; border-radius: 8px; padding: 1.25rem; }
  .pill { font-size: .75rem; font-weight: 700; padding: .15rem .5rem; border-radius: 999px; }
  .pill.pass { background: #e5f6ec; color: #136c37; }
  .pill.fail { background: #fdecec; color: #a01414; }
  details.flow { border-top: 1px solid #eceff2; padding: .5rem 0; }
  details.flow summary { cursor: pointer; display: grid; grid-template-columns: 3.4rem 1fr; gap: .5rem; align-items: baseline; }
  .status { font-size: .7rem; font-weight: 700; text-align: center; padding: .15rem .3rem; border-radius: 4px; }
  .status.passed { background: #e5f6ec; color: #136c37; }
  .status.failed, .status.timedout { background: #fdecec; color: #a01414; }
  .status.skipped { background: #eef1f4; color: #5b6b7a; }
  .flow-name { font-weight: 600; }
  .flow-meta { grid-column: 2; color: #7b8a99; font-size: .8rem; }
  table.facts { width: 100%; border-collapse: collapse; margin: .75rem 0; font-size: .85rem; }
  table.facts th, table.facts td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid #eceff2; vertical-align: top; }
  table.facts th { color: #5b6b7a; font-weight: 600; }
  tr.diff td { background: #fdecec; }
  pre.error { background: #fdecec; color: #7a1010; padding: .6rem; border-radius: 6px; overflow: auto; font-size: .8rem; }
  .shots { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  figure { margin: 0; }
  figure img { width: 100%; border: 1px solid #dfe4ea; border-radius: 4px; background: #fff; }
  figcaption { font-size: .75rem; color: #5b6b7a; margin-top: .25rem; }
  code { font-size: .95em; }
</style>
</head>
<body>
  <h1>Parity suite: ${esc(labelA)} vs ${esc(labelB)}</h1>
  <p class="meta">Same Playwright suite, user-facing selectors only, run against each build.</p>
  <p class="banner">${allGreen
    ? `All green — ${esc(labelA)} ${runA.summary.passed}/${runA.summary.total} and ${esc(labelB)} ${runB.summary.passed}/${runB.summary.total} passed`
    : `Failures present — ${esc(labelA)} ${runA.summary.passed}/${runA.summary.total}, ${esc(labelB)} ${runB.summary.passed}/${runB.summary.total}`}</p>
  <div class="runs">
    ${runSection(runA)}
    ${runSection(runB)}
  </div>
  <div class="runs" style="margin-top:1.5rem">
    ${comparisonSection(compare)}
  </div>
</body>
</html>
`;

// index.html lives in results/ so screenshots resolve as <label>/screenshots/...
fs.writeFileSync(path.join(RESULTS, 'index.html'), html);
console.log('Dashboard written to results/index.html');
