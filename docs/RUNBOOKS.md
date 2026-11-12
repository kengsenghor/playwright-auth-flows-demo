# Runbooks

Operational procedures for this repository. It is a test suite, not a deployed service, so there is nothing to deploy to
production. "Deployment" here means **running the pipeline**, and "rollback" means **reverting a change to the suite**.
Design context is in [`ARCHITECTURE.md`](ARCHITECTURE.md); setup is in [`ONBOARDING.md`](ONBOARDING.md).

> **Safety rules for every procedure:** the suite targets the live production site. Never loop or `--repeat-each`
> against it, never commit `.env` or `.auth/`, never solve or bypass a captcha in code, and use a dedicated test account.

## 1. Running the pipeline

| Goal | How |
| --- | --- |
| Typecheck | Automatic on every push and pull request (`npm run typecheck`). |
| Run tests on GitHub | Automatic on every push; or Actions tab → **Playwright** → **Run workflow**. Pick the browser; optionally set `max_skipped`. |
| Find the report | Open the run → **Summary** page → **Playwright report (one HTML file)** → **Open** (sign in to GitHub). Full report with traces: **Artifacts** → `playwright-<browser>` (14 days). |
| Read the run summary | Same Summary page: skipped, known-issue and flaky tests with reasons. |

Before relying on a green run, read the run summary. A skip means *not verified*.

## 2. Incident procedures

### R1. A run is red

1. Open the run's Summary page and the run summary. Separate **failed** from **skipped**.
2. Download `playwright-<browser>` and open the trace (`npx playwright show-trace <trace.zip>`).
3. Check whether the site changed or showed a captcha before suspecting the code. Re-run once manually.
4. Same failure twice → treat as real: fix the page object or step (R6). If the site itself is down or stalling, record
   it in the run and re-run later; do not weaken an assertion.

### R2. Saved session expired (`AF-LOGIN-03` fails with "session was rejected")

1. On a machine with a display: `npm run auth:save`, log in by hand (solve the captcha yourself), close the browser.
2. Local runs now work with the new `.auth/user.json`.
3. For CI, refresh the secret:

   ```bash
   gzip -9c .auth/user.json | base64 | tr -d '\n' | gh secret set AUTH_SESSION_B64 --repo kengsenghor/playwright-auth-flows-demo
   ```

4. Re-run the workflow manually and confirm `AF-LOGIN-03` passes.

Never paste the session into a ticket, chat or commit: it contains live tokens.

### R3. Captcha everywhere (many skips, `AF-LOGIN-04` / `05` / `AF-SIGNUP-06`)

1. Stop re-running. Each retry raises the captcha rate.
2. Wait before trying again; the block is per IP and time based.
3. For a local check use manual-assist: `npm run test:login:manual` (headed, a person solves the captcha).
4. If skips on CI are a recurring gap, ask the tenant owner for an allow-listed test account or bot protection off for it.
   This is the durable fix (ADR-004).

### R4. Account locked after wrong-password attempts

1. `AF-LOGIN-05` uses a real account's username with a wrong password; repeated runs can lock it.
2. Unlock through the account owner or the product's password-reset flow.
3. Stop manual runs that use the account until it is a dedicated test account, or clear the `AUTH_TEST_USERNAME` /
   `AUTH_TEST_PASSWORD` secrets so the test skips.

### R5. A secret or session was exposed

Treat as an incident immediately: a committed `.env`, a pasted session, or a report containing credentials.

1. Rotate the password for the affected account and invalidate its sessions.
2. Delete and recreate the GitHub secrets (`AUTH_TEST_USERNAME`, `AUTH_TEST_PASSWORD`, `AUTH_SESSION_B64`).
3. If it reached git history, remove it from history and force-push only with the repo owner's agreement; assume it was
   already read and rely on rotation, not deletion.
4. If a report artifact or Pages site holds it, delete the artifact / unpublish. Pages sites are public; unpublish by
   disabling Pages (Settings → Pages) and deleting the `gh-pages` branch.
5. Note what leaked, when, and what was rotated.

### R6. A test is flaky or the site changed

1. Reproduce headed (`npm run test:login:headed`). Passes headed but fails headless → suspect timing or bot protection.
2. Fix the **page object or step**. Do not edit a `ThenI…` assertion or a spec to turn a failure green unless the
   requirement itself changed.
3. Run the single test (`npx playwright test -g "<ID>"`), then the whole flow, then `npm run typecheck`.

### R7. Test data cleanup (live signup `AF-SIGNUP-06` ran)

1. Find the created email in the report's `test-data-created` annotation (`<base>+<unique>@<domain>`).
2. Ask the product's tenant owner to delete the account, or leave it if the mailbox is yours and the account is harmless.
3. Keep `RUN_LIVE_SIGNUP` unset except for deliberate runs.

### R8. GitHub Actions problems

| Symptom | Action |
| --- | --- |
| `ubuntu-latest` / browser install fails | The runner is pinned to `ubuntu-24.04` for a reason (ARCHITECTURE ADR-008). Do not change it without checking Playwright support. |
| Standalone report step failed | It is a convenience and never fails the run. Use the `playwright-<browser>` artifact. |
| `publish-report` job failed with "secret survived redaction" | Working as designed: nothing was published. Find which value leaked into the report, rotate it (R5), then re-run. |

## 3. Rollback

There is no deployed artifact, so rollback is a git operation on the suite.

1. Identify the commit that broke the suite: `git log --oneline` and compare against the last green run.
2. Revert it on a branch: `git revert <sha>` (do not rewrite shared history).
3. Run `npm run typecheck`, the affected tests, then open a pull request (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).
4. Re-run the workflow manually to confirm.

To stop all runs quickly (for example during R3 or R4): Actions tab → **Playwright** → **⋯** → **Disable workflow**.
Re-enable it when the cause is fixed.

## 4. Escalation

| Situation | Owner |
| --- | --- |
| Suite code, pipeline, secrets | Repository owner |
| Captcha policy, allow-listed account, account unlock | Owner of the tenant under test |
| Exposed credentials | Repository owner immediately, then your security contact |
