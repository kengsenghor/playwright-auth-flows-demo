# playwright-auth-flows-demo

Playwright + TypeScript automation for the signup and login flows of a website you point it at (`TARGET_APP_URL`), written as
BDD-style steps on Page Objects. It shows how to test an Auth0-fronted flow honestly: bot protection is never bypassed,
and every skipped test is reported with its reason instead of being counted as a pass.

> **Disclaimer.** This is an unofficial, educational project, not affiliated with or endorsed by any website it is
> pointed at. It drives a **live website**, so run it only against sites you own or are authorised to test, sparingly,
> within their terms of use, and only with accounts you own. It does not solve or bypass captchas. Use at your own
> risk; see [`LICENSE`](LICENSE).

Documentation: [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) (design, C4 diagrams, decisions), [`ONBOARDING.md`](docs/ONBOARDING.md)
(setup), [`RUNBOOKS.md`](docs/RUNBOOKS.md) (incidents and rollback), [`CONTRIBUTING.md`](docs/CONTRIBUTING.md),
[`AGENT.md`](docs/AGENT.md) (rules for AI agents), and a [reviewer walkthrough](docs/INSTRUCTIONS.html) (open in a browser).
Security reports: [`SECURITY.md`](SECURITY.md).

## What the automation covers

Both entry URLs redirect to Auth0 universal login on the host in `TARGET_SSO_URL`; login is identifier-first
(email → Continue → password → Sign in).

| Flow | Scenarios |
| --- | --- |
| **Signup** (`AF-SIGNUP-01…06`) | Form, legal links and social options render · empty submit rejected · four invalid email formats rejected · "Sign in" link · live signup with a unique email (opt-in, see below). `AF-SIGNUP-04` checks that an unticked terms box is rejected at the email step (on 2026-11-09 the site advanced without it; on 2026-11-10 it enforces it). |
| **Login** (`AF-LOGIN-01…06`) | Form and social options render · empty identifier rejected · valid login reaches the app (via a saved session, see below) · invalid credentials rejected (data-driven) · valid email with a wrong password rejected · "Sign up" link |

### Structure

```
e2e-tests/
  data/       environment URLs, credentials (from env), test matrices
  fixtures/   `test` extended with test-data bookkeeping and tracker blocking
  helper/     unique-email generator, redirect wait helper
  pages/      Page Objects: role/label-based locators + single-action methods
  steps/      BDD steps: Given / When / Then built from page objects (assertions live here)
  reporters/  run-summary reporter: lists skipped / known-issue / flaky tests, optional skip gate
  specs/      Readable scenarios that only call steps (login.spec.ts, login-session.spec.ts, signup.spec.ts)
.auth/        Saved login session (created locally, git-ignored, never commit)
```

Documentation is in `docs/`; `CLAUDE.md` at the root loads the agent rules for Claude Code.

Other files: `playwright.config.ts` (chromium/firefox/webkit projects, trace/screenshot/video on failure, HTML + JUnit
reporters), `.github/workflows/playwright.yml` (GitHub Actions: typecheck → tests → reports, see **CI** below).

### Design choices

- **Locators:** `getByRole` with accessible names first, then label, then stable id. No XPath or positional CSS.
- **Waits:** no fixed sleeps. Auto-waiting actions and web-first assertions only; the post-login redirect uses
  `waitForURL`.
- **Reuse:** one login implementation in the steps layer, used by every spec.
- **Bot protection:** a captcha is never solved or bypassed by code. Valid login reuses a session a person saved once;
  fresh-login tests skip with a reason, or a person solves the captcha in manual-assist mode.
- **Test data:** negative signup cases stop before a valid submit, so they create nothing. The one live signup uses a
  plus-addressed mailbox you control and is recorded as a report annotation.
- **Secrets:** read from the environment only. `.env` is git-ignored; `.env.example` shows the variables.

## Run it

```bash
npm install && npx playwright install --with-deps chromium
cp .env.example .env        # then set TARGET_APP_URL and TARGET_SSO_URL (required); credentials are optional
npm test                    # chromium
npm run test:headed
npm run test:login          # login specs (fresh-login tests skip if a captcha appears)
npm run auth:save           # one-time: log in by hand to save .auth/user.json (needed for AF-LOGIN-03)
npm run test:login:manual   # local, headed: pause at a captcha so you can solve it, then continue
npm run typecheck
npm run report              # open the last HTML report
```

| Variable | Purpose |
| --- | --- |
| `TARGET_APP_URL` | **Required.** Origin of the app under test, e.g. `https://app.example.com` (no path). |
| `TARGET_SSO_URL` | **Required.** Origin of the Auth0 login host the app redirects to, e.g. `https://sso.example.com`. |
| `ENV` | Target environment (default in `.env.example`) |
| `AUTH_TEST_USERNAME` / `AUTH_TEST_PASSWORD` | An existing account, for the wrong-password test (`AF-LOGIN-05`). The test skips when unset. |
| `AUTH_STORAGE_STATE` | Path to a saved login session (default `.auth/user.json`). CI can point it at a secret file. |
| `MAX_SKIPPED=<n>` | Optional gate: the run fails when more than `n` tests were skipped. |
| `MANUAL_CAPTCHA=1` | Manual-assist mode (set by `npm run test:login:manual`). Headed runs only; ignored in headless and CI. |
| `SIGNUP_BASE_EMAIL` | A mailbox you control that supports plus-addressing, for the live signup test |
| `RUN_LIVE_SIGNUP=1` | Opt-in for `AF-SIGNUP-06`, which submits a **real signup**. Without it the test skips. |

## CI

CI is **GitHub Actions only** (`.github/workflows/playwright.yml`).

- **Runs:** typecheck on every push and pull request; the tests run on
  manual dispatch (Actions tab → Playwright → Run workflow; choose the browser and an optional `max_skipped` gate); there is no scheduled run. They are not run on every push
  because each run hits the live site and repeated logins trigger the captcha. Each run uploads the HTML report and
  traces and shows the skipped / known-issue / flaky lists in the job summary.
  Required: `TARGET_APP_URL` and `TARGET_SSO_URL`, as repository **secrets** (masked in public logs and redacted from the report) or as variables (Settings → Secrets and variables → Actions).
  Optional repository secrets: `AUTH_TEST_USERNAME`, `AUTH_TEST_PASSWORD`, `SIGNUP_BASE_EMAIL`, and
  `AUTH_SESSION_B64` (a gzip + base64 copy of `.auth/user.json` for `AF-LOGIN-03`; compressed because a plain base64 copy is ~54 KB, over GitHub's 48 KB secret limit; it holds live tokens and expires).
  GitHub's cloud IPs may meet the captcha more often, so expect more skips there. The workflow has been run on GitHub (chromium) and passed; read each run's summary for what was skipped.

  Add the secrets from your own machine (each `gh secret set` prompts for the value, or reads it from the pipe). Use a
  **dedicated test account**: these are real credentials and wrong-password attempts can lock an account.

  ```bash
  REPO=kengsenghor/playwright-auth-flows-demo
  gh secret set AUTH_TEST_USERNAME --repo "$REPO"
  gh secret set AUTH_TEST_PASSWORD --repo "$REPO"
  gh secret set SIGNUP_BASE_EMAIL  --repo "$REPO"                  # only needed for the opt-in live signup
  gzip -9c .auth/user.json | base64 | tr -d '\n' | gh secret set AUTH_SESSION_B64 --repo "$REPO"   # after `npm run auth:save`
  ```

  `auth:save` cannot run on CI (it needs a person to solve the captcha), so the saved session is created locally and
  uploaded. It expires: `AF-LOGIN-03` then fails with a message saying the session was rejected, and the secret needs
  refreshing. With credentials set, `AF-LOGIN-05` still skips whenever the captcha appears before the password step.
- **Where to find the report (works on a private repo):** Actions tab → open the run → on the run's **Summary** page, the
  section **Playwright report (one HTML file)** has an **Open** link to `playwright-report.html` (sign in to GitHub; it
  opens inline in the browser, nothing to download). The same page lists the run summary
  (skipped / known-issue / flaky tests) and, under **Artifacts** at the bottom, both `playwright-report.html` and
  `playwright-<browser>` (the full report with traces, screenshots and videos, kept 14 days). The single-file copy has
  traces, screenshots and videos removed and secret values redacted.
- **Published HTML report (GitHub Pages): disabled for now.** The repo is private and Pages on a private repo needs a
  paid plan, so the `publish-report` job is switched off (it runs only when the repository variable `PUBLISH_REPORT` is
  `true` and Pages is set to *GitHub Actions*). When enabled it puts each run's report at
  `https://<user>.github.io/<repo>/<run id>/`, with `/latest/` and an index of the newest 5 runs.
  Pages sites are public even for private repositories (and private-repo Pages needs a paid plan), so the published copy
  has every attachment removed (traces, screenshots and videos can contain typed credentials and the account email),
  the exact secret values are redacted from the report data, and the job fails without publishing if one survives
  (`.github/scripts/report-store.mjs`). The complete report is always in the run's artifact.

## Known limitations (please read before running)

- **It runs against the live site.** There is no test environment, so results depend on the site's availability.
  The SSO redirect and the Auth0 stylesheet were observed to stall intermittently. The page objects retry navigation
  and wait for stylesheets, and ad/tracker hosts are blocked in the shared fixture. This **reduced** the flakiness but
  did not remove it.
- **Bot protection.** Repeated live signups triggered a CAPTCHA. That is why live signup is opt-in, and it skips itself
  when a CAPTCHA appears. The suite does not try to get around it. Avoid repeat loops (`--repeat-each`) against
  production.
- **Login captcha.** A fresh login (`AF-LOGIN-04`, `AF-LOGIN-05`) can trigger Auth0's CAPTCHA. Those tests then report
  as **skipped** with the reason, never passed, and the CAPTCHA is not bypassed. A skip means *not verified*, so read
  skipped counts as gaps. `AF-SIGNUP-06` (opt-in) is the other expected skip. Every run ends with a **run summary** that lists each skipped test with its reason, plus known issues and flaky tests. The valid-login check (`AF-LOGIN-03`)
  reuses a saved session instead: run `npm run auth:save`, log in once by hand, and the session is written to
  `.auth/user.json` (git-ignored, contains live tokens, so never share it). Redo it when the session expires.
  The real fix is an allow-listed test account or a tenant with bot protection off. For local runs there is a
  manual-assist mode: `npm run test:login:manual` (headed, `MANUAL_CAPTCHA=1`) pauses at the captcha so a person
  solves it in the browser, then the test continues and really checks the credentials. It is local-only (no CI).
  Verified on 2026-11-10: a manual run passed all 7 login tests, including `AF-LOGIN-04` and `AF-LOGIN-05`.
  With a captcha on the first page, the browser's own required-field validation blocks an empty submit, so
  `AF-LOGIN-02` accepts either that or Auth0's error message.
- **Account lockout risk.** The wrong-password test (`AF-LOGIN-05`) uses the same real account as the saved session. Use a dedicated
  test account and keep repeated wrong-password runs to a minimum.
- **Preferred setup:** a dedicated test tenant or staging environment, with test accounts and a way to delete the
  accounts that tests create.
- **Selectors and URLs** were verified against the live pages on 2026-11-09. Error *wording* is not asserted, only
  visibility, because it can change.
