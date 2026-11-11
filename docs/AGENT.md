# AGENT.md: project instructions for AI agents

Instructions for any AI coding agent (Claude Code, Cursor, etc.) working in this repository. This file points to the
authoritative documents rather than duplicating them. When in doubt, the linked files win.

> **Precedence:** `ARCHITECTURE.md` (design rules) > this file > [`README.md`](../README.md) for conventions. Facts about commands and
> variables come from `README.md` and `package.json`.

## What this repo is

Playwright + TypeScript UI automation (BDD-style steps on Page Objects) for the signup and login flows of the site configured in `TARGET_APP_URL`.
It runs against the **live production site**; there is no test environment and no API.

## Read first

1. [`ARCHITECTURE.md`](ARCHITECTURE.md): layers, ADRs, what runs where.
2. [`ONBOARDING.md`](ONBOARDING.md): setup, commands, how to add a test.
3. [`RUNBOOKS.md`](RUNBOOKS.md): incident procedures (expired session, captcha, account lockout, leaked secret).
4. [`CONTRIBUTING.md`](CONTRIBUTING.md): pull request checklist and standards.

## Commands

```bash
npm install && npx playwright install --with-deps chromium
npm run typecheck                       # run before every commit
npm test                                # chromium, headless
npx playwright test -g "AF-LOGIN-04"   # one scenario by ID
npm run report                          # open the HTML report
```

## Layering (enforced in review)

```
specs/  -> step calls only. Extended `test` from fixtures/. NO expect, NO locators, NO raw page actions.
steps/  -> Given / When / Then. ALL assertions (ThenI…). NO selectors.
pages/  -> role/label locators + single-action methods. NO expect().
```

Locator priority: `getByRole` with name, then label, then stable id. No XPath, no positional CSS, no fixed sleeps.
Scenario IDs (`AF-LOGIN-0n`, `AF-SIGNUP-0n`) are stable; take the next free number.

## Hard constraints

- **Never point a run at anything but the configured site, and never loop against it.** No `--repeat-each`, no
  retry-until-green scripts: repeated logins and signups trigger the captcha.
- **Never solve or bypass a captcha in code.** Skip with a reason, or use the local manual-assist mode.
- **Never edit an assertion or a spec to make a failing test pass.** That masks a bug. Stop and report. Fix page
  objects or steps when the site changed.
- **No secrets in the repo.** Never read, print, commit or paste `.env`, `.auth/`, or secret values. Credentials come
  from the environment only. If you see one in a diff, stop and report it.
- **No fake completion.** `test.skip` without a reason, `.only`, stub tests, TODO placeholders and unimplemented
  branches are blockers, not evidence. Skipped means *not verified*, never passed.
- **Do not create accounts.** `AF-SIGNUP-06` is opt-in (`RUN_LIVE_SIGNUP=1`); do not enable it without being asked.
- **Do not change repository visibility, push, or force-push without being asked.** The GitHub repository is private.

## Git

- Work on a branch; target `main` through a pull request.
- Plain, short, imperative commit messages. Check `git config user.email` is the repository's configured identity before
  committing.
- Documentation lives in `docs/`.
- Do not commit `playwright-report/`, `test-results/`, `.auth/`, `.env` (all git-ignored).

## Before reporting done

1. `npm run typecheck` is clean.
2. The affected scenario ran, and you can state every skip and its reason.
3. `git diff` contains no secrets, `.only`, unexplained skips, fixed sleeps or XPath.
4. Docs updated if commands, variables, scenarios or CI changed.

## Terminology

Use **Software Test Engineer** for the role and **software testing** for the activity, in code, comments, commit messages
and documents.
