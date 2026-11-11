// Turns test-results/run-summary.json (written by e2e-tests/reporters/run-summary.reporter.ts) into Markdown for the
// GitHub job summary. Usage: node .github/scripts/run-summary-to-markdown.js >> "$GITHUB_STEP_SUMMARY"
const fs = require('fs');

const file = 'test-results/run-summary.json';
if (!fs.existsSync(file)) process.exit(0);

const s = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = rows => rows.map(r => `- ${r.title}${r.reason ? `: ${r.reason}` : ''}`).join('\n') || 'none';

console.log('## Run summary\n');
console.log(`passed ${s.passed} | failed ${s.failed} | skipped ${s.skipped.length} | known issues ${s.knownIssues.length} | flaky ${s.flaky.length}\n`);
console.log(`### Not verified (skipped)\n${list(s.skipped)}\n`);
console.log(`### Known issues\n${list(s.knownIssues)}\n`);
console.log(`### Flaky (passed only on a retry)\n${list(s.flaky)}`);
