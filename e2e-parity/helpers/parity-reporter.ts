import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { BASE_URL, RESULTS_DIR, RUN_LABEL } from '../playwright.config';

interface Checkpoint { name: string; file: string; route: string }
interface Fact { key: string; value: string | number | boolean }
interface FlowResult {
  flow: string;
  file: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  durationMs: number;
  error?: string;
  facts: Fact[];
  checkpoints: Checkpoint[];
}
export interface ParityReport {
  runLabel: string;
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  appVersion?: string;
  summary: { total: number; passed: number; failed: number; skipped: number };
  flows: FlowResult[];
}

/**
 * Writes results/<RUN_LABEL>/parity-report.json + parity-report.md.
 * The JSON is stable-keyed and sorted so two runs can be diffed directly or
 * via scripts/compare.js.
 */
export default class ParityReporter implements Reporter {
  private flows: FlowResult[] = [];
  private startedAt = new Date().toISOString();
  private appVersion?: string;

  onBegin(_config: FullConfig) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const facts: Fact[] = [];
    const checkpoints: Checkpoint[] = [];
    for (const a of test.annotations) {
      if (!a.description) continue;
      if (a.type === 'fact') facts.push(JSON.parse(a.description));
      if (a.type === 'checkpoint') checkpoints.push(JSON.parse(a.description));
      if (a.type === 'app-version') this.appVersion = a.description;
    }
    this.flows.push({
      flow: test.title,
      file: path.relative(process.cwd(), test.location.file),
      status: result.status,
      durationMs: result.duration,
      error: result.error?.message?.split('\n')[0],
      facts: facts.sort((a, b) => a.key.localeCompare(b.key)),
      checkpoints,
    });
  }

  onEnd(_result: FullResult) {
    const flows = this.flows.sort((a, b) => a.flow.localeCompare(b.flow));
    const report: ParityReport = {
      runLabel: RUN_LABEL,
      baseUrl: BASE_URL,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      appVersion: this.appVersion,
      summary: {
        total: flows.length,
        passed: flows.filter((f) => f.status === 'passed').length,
        failed: flows.filter((f) => f.status === 'failed' || f.status === 'timedOut').length,
        skipped: flows.filter((f) => f.status === 'skipped').length,
      },
      flows,
    };
    fs.writeFileSync(path.join(RESULTS_DIR, 'parity-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(RESULTS_DIR, 'parity-report.md'), toMarkdown(report));
    console.log(`\nParity report written to ${path.relative(process.cwd(), RESULTS_DIR)}/parity-report.{json,md}`);
  }
}

function toMarkdown(r: ParityReport): string {
  const lines: string[] = [];
  lines.push(`# Parity report: ${r.runLabel}`, '');
  lines.push(`- Base URL: ${r.baseUrl}`);
  if (r.appVersion) lines.push(`- App version (from UI): ${r.appVersion}`);
  lines.push(`- Started: ${r.startedAt}`);
  lines.push(`- Result: **${r.summary.passed}/${r.summary.total} passed**, ${r.summary.failed} failed, ${r.summary.skipped} skipped`, '');
  lines.push('| Flow | Status | Duration |', '|---|---|---|');
  for (const f of r.flows) lines.push(`| ${f.flow} | ${f.status} | ${(f.durationMs / 1000).toFixed(1)}s |`);
  lines.push('');
  for (const f of r.flows) {
    lines.push(`## ${f.flow}`, '');
    if (f.error) lines.push(`> Error: ${f.error}`, '');
    if (f.facts.length) {
      lines.push('| Fact | Value |', '|---|---|');
      for (const fact of f.facts) lines.push(`| ${fact.key} | ${String(fact.value)} |`);
      lines.push('');
    }
    if (f.checkpoints.length) {
      lines.push('| Checkpoint | Route | Screenshot |', '|---|---|---|');
      for (const c of f.checkpoints) lines.push(`| ${c.name} | ${c.route} | screenshots/${c.file} |`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
