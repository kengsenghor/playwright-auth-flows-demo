# Onboarding

Welcome. This guide gets you from a fresh clone to a first green run, then explains how the code is organised and how to
add or fix a test. For the project overview, limitations and CI details read [`README.md`](../README.md); for the design
rationale read [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 1. What this repo is

Playwright + TypeScript UI automation for the **signup** and **login** flows, written
in a BDD style (Given / When / Then steps) on top of Page Objects. It runs against the **live site** (there is no test
environment), so results depend on the site's availability and bot protection.

## 2. Prerequisites

> **Platform:** this framework was prepared and verified on **macOS** only. The commands in this guide are macOS/zsh.
> It has not been run on Windows or Linux. Inline environment variables such as `MANUAL_CAPTCHA=1` in the npm scripts, and
> the `gzip | base64` secret command, are POSIX-shell syntax, so on Windows use WSL or Git Bash. CI runs on GitHub's Linux
> runners, but locally you may need to adjust paths and shell commands on other platforms.

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 LTS (22.x) or newer | `node -v` to check. Use `nvm`, `fnm` or `brew` to switch. |
| npm | Bundled with Node | The bundled npm is fine. You do not need to upgrade it. |
| Git | Any recent version | |
| GitHub CLI (`gh`) | Optional | Only for managing CI secrets. |

## 3. First run (about 5 minutes)

```bash
git clone https://github.com/kengsenghor/playwright-auth-flows-demo.git playwright-auth-flows-demo
cd playwright-auth-flows-demo
npm install
npx playwright install --with-deps chromium   # or: npm run install:browsers (all browsers)
cp .env.example .env                           # set TARGET_APP_URL and TARGET_SSO_URL (required); see section 4
npm run typecheck                              # should print nothing
npm test                                       # chromium, headless
npm run report                                 # open the HTML report
```

A normal first run shows some tests as **skipped**. That is expected (see section 6), not a setup problem.

## 4. Configuration (`.env`)

`.env` is git-ignored. Copy `.env.example`. `TARGET_APP_URL` and `TARGET_SSO_URL` are required; everything else is optional.

| Variable | Purpose |
| --- | --- |
| `TARGET_APP_URL` / `TARGET_SSO_URL` | **Required.** Origins (https, no path) of the app under test and its Auth0 login host. |
| `ENV` | Target environment (default in `.env.example`). |
| `AUTH_TEST_USERNAME` / `AUTH_TEST_PASSWORD` | An existing account, used by the wrong-password test `AF-LOGIN-05`. Skips when unset. Use a **dedicated test account**: wrong-password attempts can lock a real account. |
| `AUTH_STORAGE_STATE` | Path to a saved login session (default `.auth/user.json`). |
| `SIGNUP_BASE_EMAIL` | A mailbox you control that supports plus-addressing, for the live signup test. |
| `RUN_LIVE_SIGNUP=1` | Opt in to `AF-SIGNUP-06`, which submits a **real signup**. Off by default. |
| `MANUAL_CAPTCHA=1` | Manual-assist mode (set by `npm run test:login:manual`). Headed local runs only. |
| `MAX_SKIPPED=<n>` | Gate: fail the run when more than `n` tests were skipped. |

Never commit `.env` or anything in `.auth/`. The saved session contains live tokens.

## 5. Everyday commands

| Command | What it does |
| --- | --- |
| `npm test` | All specs on chromium. |
| `npm run test:headed` | Same, with a visible browser. |
| `npm run test:login` / `test:signup` | One flow only (`:headed` variants exist). |
| `npm run auth:save` | One-time: log in by hand to save `.auth/user.json` (needed for `AF-LOGIN-03`). |
| `npm run test:login:manual` | Headed run that pauses at a captcha so you can solve it, then continues. |
| `npm run typecheck` | `tsc --noEmit`. Run before every commit. |
| `npm run report` | Open the last HTML report. |
| `npx playwright test -g "AF-LOGIN-04"` | Run a single test by title. |
| `npx playwright test --debug` | Step through with the Playwright Inspector. |
| `npx playwright show-trace <trace.zip>` | Inspect a failure trace. |

Avoid `--repeat-each` or tight loops against the live site: repeated logins and signups trigger the captcha.

## 6. Things that will surprise you

- **Skipped is not passed.** A skip means *not verified*. Fresh-login tests (`AF-LOGIN-04`, `AF-LOGIN-05`) skip with a
  reason when Auth0 shows a captcha, and `AF-SIGNUP-06` skips unless you opt in. Every run ends with a run summary that
  lists skipped, known-issue and flaky tests.
- **We never solve or bypass a captcha in code.** Valid login (`AF-LOGIN-03`) reuses a session a person saved with
  `npm run auth:save`. When it expires the test fails with a message saying the session was rejected; save it again.
- **Login is identifier-first** on Auth0 (the host in `TARGET_SSO_URL`): email, Continue, password, Sign in.
- **Flakiness is reduced, not removed.** The SSO redirect and stylesheet can stall. Page objects retry navigation and the
  shared fixture blocks ad and tracker hosts.
- **Error wording is not asserted**, only visibility, because the site's copy changes.

## 7. How the code is organised

```
e2e-tests/
  data/       environment URLs, credentials (from env), test matrices
  fixtures/   `test` extended with test-data bookkeeping and tracker blocking
  helper/     unique-email generator, redirect wait helper
  pages/      Page Objects: locators + single-action methods, no assertions
  steps/      BDD steps (Given / When / Then) built from page objects; assertions live here
  reporters/  run-summary reporter (skipped / known-issue / flaky list, optional skip gate)
  specs/      Readable scenarios that only call steps
playwright.config.ts   projects, timeouts, retries, reporters, failure evidence
.github/workflows/     GitHub Actions pipeline
docs/                  ARCHITECTURE, ONBOARDING, RUNBOOKS, CONTRIBUTING, AGENT (.md) and INSTRUCTIONS.html
CLAUDE.md              loads docs/AGENT.md and docs/ARCHITECTURE.md for Claude Code
```

### Layer rules (these are enforced in review)

| Layer | May contain | Must not contain |
| --- | --- | --- |
| `specs/` | Test titles with ID, calls to steps | Locators, `expect`, raw Playwright actions |
| `steps/` | Given / When / Then composed from pages, **all assertions** | Raw selectors |
| `pages/` | Locators and single-action methods | Assertions, test logic |

Conventions:

- **Locators:** `getByRole` with the accessible name first, then label, then a stable id. No XPath, no positional CSS.
- **Waits:** no fixed sleeps. Use auto-waiting actions and web-first assertions; `waitForURL` for the post-login redirect.
- **IDs:** each scenario carries an ID in its title (`AF-LOGIN-0n`, `AF-SIGNUP-0n`). Keep numbering stable.
- **Reuse:** one login implementation in the steps layer, used by every spec.
- **Test data:** negative signup cases stop before a valid submit so they create nothing. Generate emails with the helper,
  never hard-code them.
- **Secrets:** read from the environment only.

## 8. Adding or changing a test

1. Write the scenario in plain words and give it the next free ID.
2. Add or reuse locators and single-action methods in the relevant `pages/*.page.ts`.
3. Compose Given / When / Then in `steps/*.steps.ts`, with the assertions there.
4. Add the spec in `specs/*.spec.ts`, calling steps only. Use the extended `test` from `fixtures/`, not `@playwright/test`
   directly.
5. Run it alone with `-g "<ID>"`, then run the whole flow, then `npm run typecheck`.
6. Update the scenario table in `README.md` if you added a scenario.
7. Open a pull request following [`CONTRIBUTING.md`](CONTRIBUTING.md).

If a test must skip (captcha, missing credentials), skip it **with a reason**. Do not use `test.skip()` without one,
do not leave `.only` in, and do not weaken an assertion to make a failure go away.

## 9. Debugging a failure

For an expired session, captcha wall, locked account or leaked secret, follow [`RUNBOOKS.md`](RUNBOOKS.md). Otherwise:

1. Open the HTML report (`npm run report`). Failures keep a trace, screenshot and video.
2. Open the trace: `npx playwright show-trace test-results/<test>/trace.zip`.
3. Check whether the site changed (selectors were last verified 2026-11-09) or a captcha appeared before suspecting your code.
4. Re-run once headed (`npm run test:login:headed`). If it passes headed but fails headless, suspect timing or bot protection.
5. Fix the page object or step, never the spec's assertion, unless the requirement itself changed.

## 10. CI (GitHub Actions only)

Workflow: `.github/workflows/playwright.yml`.

- Typecheck runs on every push and pull request.
- Tests run on **every push** and on **manual dispatch** (Actions tab, Playwright, Run workflow; pick the browser, an optional `max_skipped`, and whether to run the live signup `AF-SIGNUP-06`)
  (no scheduled run). Pull requests only typecheck. Each run hits the live site, so captcha skips are expected.
- Find the report: Actions tab, open the run, **Summary** page, **Playwright report (one HTML file)**, **Open**. The full
  report with traces is under **Artifacts** (kept 14 days).
- Required: `TARGET_APP_URL`, `TARGET_SSO_URL` (as repository secrets or variables).
- Optional repository secrets: `AUTH_TEST_USERNAME`, `AUTH_TEST_PASSWORD`, `SIGNUP_BASE_EMAIL`, `AUTH_SESSION_B64`
  (gzip + base64 of `.auth/user.json`). Setup commands are in the README's CI section. GitHub's cloud IPs meet the
  captcha more often, so expect more skips there.

## 11. Where to read next

| Topic | File |
| --- | --- |
| Overview, limitations, full variable list | [`README.md`](../README.md) |
| Design, diagrams and decisions (ADRs) | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Incidents and rollback | [`RUNBOOKS.md`](RUNBOOKS.md) |
| How to contribute, pull request checklist | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Rules for AI coding agents | [`AGENT.md`](AGENT.md) |
| Walkthrough for reviewers | [`INSTRUCTIONS.html`](INSTRUCTIONS.html) |

## 12. Checklist before your first pull request

The full checklist is in [`CONTRIBUTING.md`](CONTRIBUTING.md) §3. The essentials:

- [ ] `npm run typecheck` is clean.
- [ ] The affected flow passes locally, and you know why any skips are skipped.
- [ ] No `.only`, no unexplained `skip`, no fixed sleeps, no XPath.
- [ ] No secrets, `.env` or `.auth/` content in the diff.
- [ ] README scenario table updated if scenarios changed.
