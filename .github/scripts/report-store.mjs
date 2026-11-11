// Prepares a Playwright HTML report for publishing to GitHub Pages and adds it to the report store.
//
//   node report-store.mjs --report <playwright-report dir> --store <store dir> --run-id <id> --run-number <n>
//                         --run-url <url> [--keep 5] [--summary <run-summary.json>]
//
// What it does, in order:
//   1. Copies the report and REMOVES every attachment (traces, screenshots, videos, error-context). They can hold
//      typed credentials, cookies and the account's email, and a Pages site is public. The complete report stays in the
//      workflow run's artifact.
//   2. Rewrites the report data embedded in index.html (a base64 zip): drops attachment references and replaces the
//      exact values of the configured secrets with [redacted].
//   3. FAILS CLOSED: it re-reads the rewritten report and every published file and aborts (exit 1, nothing published)
//      if any secret value is still present. A missing report is also an error.
//   4. Stores it as <store>/<run-id>/ and <store>/latest/, keeps only the newest --keep runs and rebuilds
//      <store>/index.html.
// A missing report is an error (the caller only runs this after the tests uploaded one).
//
// Node built-ins plus the system `zip` / `unzip` (present on GitHub's ubuntu runners). No npm dependency.
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Environment variables whose VALUES must never reach the published site.
const SECRET_ENV_NAMES = ['AUTH_TEST_USERNAME', 'AUTH_TEST_PASSWORD', 'SIGNUP_BASE_EMAIL', 'AUTH_SESSION_B64', 'TARGET_APP_URL', 'TARGET_SSO_URL'];
const MIN_SECRET_LENGTH = 4; // shorter values would mangle ordinary text

const EMBED_RE = /(window\.playwrightReportBase64\s*=\s*")data:application\/zip;base64,([^"]*)(")/;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

function secretValues() {
  return SECRET_ENV_NAMES.map(n => process.env[n] ?? '').filter(v => v.length >= MIN_SECRET_LENGTH);
}

/** Every spelling a secret can take inside JSON / HTML / URLs. */
function variants(secret) {
  return [...new Set([secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret)])];
}

function redactText(text, secrets) {
  let out = text;
  for (const s of secrets) for (const v of variants(s)) out = out.split(v).join('[redacted]');
  return out;
}

function containsSecret(text, secrets) {
  return secrets.some(s => variants(s).some(v => text.includes(v)));
}

function stripAttachments(node) {
  if (Array.isArray(node)) return node.forEach(stripAttachments);
  if (node && typeof node === 'object') {
    if (Array.isArray(node.attachments)) node.attachments = [];
    Object.values(node).forEach(stripAttachments);
  }
}

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walkFiles(join(dir, e.name)) : [join(dir, e.name)]
  );
}

/** Rewrites the base64 zip embedded in index.html; returns the new index.html text. */
function rewriteEmbeddedReport(html, secrets) {
  const m = html.match(EMBED_RE);
  if (!m) throw new Error('index.html has no embedded report data (unexpected Playwright report format)');
  const work = mkdtempSync(join(tmpdir(), 'pw-report-'));
  try {
    const inZip = join(work, 'in.zip');
    const dir = join(work, 'x');
    writeFileSync(inZip, Buffer.from(m[2], 'base64'));
    mkdirSync(dir);
    execFileSync('unzip', ['-q', inZip, '-d', dir]);

    for (const file of walkFiles(dir)) {
      if (!file.endsWith('.json')) continue;
      const data = JSON.parse(readFileSync(file, 'utf8'));
      stripAttachments(data);
      writeFileSync(file, redactText(JSON.stringify(data), secrets));
    }

    const outZip = join(work, 'out.zip');
    execFileSync('zip', ['-X', '-q', '-r', outZip, '.'], { cwd: dir });

    // Verify the rewritten report on its own before trusting it.
    const check = join(work, 'check');
    mkdirSync(check);
    execFileSync('unzip', ['-q', outZip, '-d', check]);
    for (const file of walkFiles(check)) {
      const text = readFileSync(file, 'utf8');
      if (file.endsWith('.json')) JSON.parse(text);
      if (containsSecret(text, secrets)) throw new Error(`a secret survived redaction inside the embedded report (${file})`);
    }
    const b64 = readFileSync(outZip).toString('base64');
    return html.replace(EMBED_RE, (_all, pre, _old, post) => `${pre}data:application/zip;base64,${b64}${post}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function buildIndex(store) {
  const runs = readdirSync(store, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'latest' && existsSync(join(store, e.name, 'meta.json')))
    .map(e => JSON.parse(readFileSync(join(store, e.name, 'meta.json'), 'utf8')))
    .sort((a, b) => b.runNumber - a.runNumber);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rows = runs
    .map(
      r => `<tr><td><a href="${esc(r.runId)}/">#${esc(r.runNumber)}</a></td><td>${esc(r.date)}</td>` +
        `<td>${esc(r.passed)}</td><td>${esc(r.failed)}</td><td>${esc(r.skipped)}</td><td>${esc(r.knownIssues)}</td>` +
        `<td>${esc(r.flaky)}</td><td><a href="${esc(r.runUrl)}">workflow run</a></td></tr>`
    )
    .join('\n');
  writeFileSync(
    join(store, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Playwright reports</title>
<style>
  :root{--bg:#f7f8fb;--text:#1b2230;--muted:#566074;--line:#dde2ec;--accent:#1f5fd6}
  @media (prefers-color-scheme:dark){:root{--bg:#12151c;--text:#e8ecf4;--muted:#9aa5ba;--line:#2b3342;--accent:#6c9cff}}
  body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif}
  main{max-width:900px;margin:0 auto;padding:24px 16px}
  a{color:var(--accent)} p{color:var(--muted)}
  table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
</style></head><body><main>
<h1>Playwright reports</h1>
<p><a href="latest/">Latest report</a>. The newest ${runs.length} run(s) are kept. Traces, screenshots and videos are removed from
published reports; download the workflow run's artifact for them.</p>
<table><thead><tr><th>Run</th><th>Date (UTC)</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Known issues</th><th>Flaky</th><th></th></tr></thead>
<tbody>
${rows}
</tbody></table></main></body></html>
`
  );
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  for (const k of ['report', 'store', 'run-id', 'run-number', 'run-url']) {
    if (!a[k]) throw new Error(`missing --${k}`);
  }
  if (!existsSync(join(a.report, 'index.html'))) throw new Error(`no HTML report found at ${a.report}`);
  const keep = Math.max(1, Number(a.keep ?? 5));
  const secrets = secretValues();

  const stage = mkdtempSync(join(tmpdir(), 'pw-stage-'));
  try {
    cpSync(a.report, stage, { recursive: true });
    for (const d of ['data', 'trace']) rmSync(join(stage, d), { recursive: true, force: true });

    const indexPath = join(stage, 'index.html');
    writeFileSync(indexPath, rewriteEmbeddedReport(readFileSync(indexPath, 'utf8'), secrets));

    // Final gate over every file that will be published (index.html's data is compressed, verified above).
    for (const file of walkFiles(stage)) {
      if (containsSecret(readFileSync(file, 'utf8'), secrets)) {
        throw new Error(`a secret value was found in ${file}; refusing to publish`);
      }
    }

    let summary = {};
    if (a.summary && existsSync(a.summary)) {
      try { summary = JSON.parse(readFileSync(a.summary, 'utf8')); } catch { /* counts are optional */ }
    }
    const count = v => (Array.isArray(v) ? v.length : Number(v ?? 0));
    const meta = {
      runId: String(a['run-id']),
      runNumber: Number(a['run-number']),
      runUrl: a['run-url'],
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      passed: count(summary.passed), failed: count(summary.failed), skipped: count(summary.skipped),
      knownIssues: count(summary.knownIssues), flaky: count(summary.flaky)
    };
    writeFileSync(join(stage, 'meta.json'), JSON.stringify(meta, null, 2));

    mkdirSync(a.store, { recursive: true });
    for (const target of [meta.runId, 'latest']) {
      rmSync(join(a.store, target), { recursive: true, force: true });
      cpSync(stage, join(a.store, target), { recursive: true });
    }

    // Retention: newest `keep` runs (by run number) stay; `latest` always stays.
    const runs = readdirSync(a.store, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'latest' && existsSync(join(a.store, e.name, 'meta.json')))
      .map(e => ({ name: e.name, n: JSON.parse(readFileSync(join(a.store, e.name, 'meta.json'), 'utf8')).runNumber }))
      .sort((x, y) => y.n - x.n);
    for (const old of runs.slice(keep)) rmSync(join(a.store, old.name), { recursive: true, force: true });

    buildIndex(a.store);
    writeFileSync(join(a.store, '.nojekyll'), '');
    const size = walkFiles(a.store).reduce((n, f) => n + statSync(f).size, 0);
    console.log(`published run ${meta.runId} (#${meta.runNumber}); store holds ${Math.min(runs.length, keep)} run(s), ${(size / 1048576).toFixed(1)} MB`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exit(1);
}
