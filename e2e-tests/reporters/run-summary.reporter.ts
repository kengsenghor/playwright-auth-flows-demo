import * as fs from 'fs';
import * as path from 'path';
import type { FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

interface Row {
  title: string;
  project: string;
  reason: string;
}

/**
 * Makes a green run honest. Playwright's own summary counts a skipped test next to the passes; this reporter lists
 * every test that was NOT really verified (skipped, with the reason), every known issue (expected failure) and every
 * flaky test (passed only on a retry), and writes the same data to test-results/run-summary.json for CI to archive.
 *
 * Optional gate: set MAX_SKIPPED=<n> and the run is marked failed when more than n tests were skipped.
 */
export default class RunSummaryReporter implements Reporter {
  private readonly skipped: Row[] = [];
  private readonly knownIssues: Row[] = [];
  private readonly flaky: Row[] = [];
  private suite?: Suite;
  private passed = 0;
  private failed = 0;

  printsToStdio() {
    return false;
  }

  onBegin(_config: unknown, suite: Suite) {
    this.suite = suite;
  }

  /** Classified once per test at the end of the run: onTestEnd fires per attempt, which would count retries as failures. */
  private classify() {
    for (const test of this.suite?.allTests() ?? []) {
      const row: Row = { title: test.title, project: test.parent.project()?.name ?? '', reason: this.reason(test) };
      const outcome = test.outcome();
      const last = test.results[test.results.length - 1];
      if (outcome === 'skipped') this.skipped.push(row);
      else if (outcome === 'flaky') this.flaky.push(row);
      else if (outcome === 'unexpected') this.failed++;
      else if (last?.status === 'failed' && test.expectedStatus === 'failed') this.knownIssues.push(row);
      else this.passed++;
    }
  }

  async onEnd(_result: FullResult): Promise<{ status: 'failed' } | undefined> {
    this.classify();
    const max = Number(process.env.MAX_SKIPPED);
    const gate = Number.isFinite(max) && process.env.MAX_SKIPPED !== undefined && process.env.MAX_SKIPPED !== '';
    const overLimit = gate && this.skipped.length > max;

    const lines = [
      '',
      'Run summary',
      `  passed ${this.passed} | failed ${this.failed} | skipped ${this.skipped.length} | known issues ${this.knownIssues.length} | flaky ${this.flaky.length}`
    ];
    const section = (heading: string, rows: Row[]) => {
      if (!rows.length) return;
      lines.push(`  ${heading}`);
      for (const r of rows) lines.push(`    - [${r.project}] ${r.title}${r.reason ? `: ${r.reason}` : ''}`);
    };
    section('Not verified (skipped). Treat these as gaps, not passes:', this.skipped);
    section('Known issues (expected failures; they will report if the site is fixed):', this.knownIssues);
    section('Flaky (passed only on a retry):', this.flaky);
    if (overLimit) lines.push(`  GATE: ${this.skipped.length} skipped is more than MAX_SKIPPED=${max}, so the run is marked failed.`);
    console.log(lines.join('\n'));

    try {
      fs.mkdirSync('test-results', { recursive: true });
      fs.writeFileSync(
        path.join('test-results', 'run-summary.json'),
        JSON.stringify({ passed: this.passed, failed: this.failed, skipped: this.skipped, knownIssues: this.knownIssues, flaky: this.flaky }, null, 2)
      );
    } catch {
      // The summary file is a convenience for CI; never fail the run because it could not be written.
    }
    return overLimit ? { status: 'failed' } : undefined;
  }

  private reason(test: TestCase): string {
    const a = test.annotations.find(x => ['skip', 'fixme', 'fail'].includes(x.type) && x.description);
    return a?.description ?? '';
  }
}
