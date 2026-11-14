# Contributing

How to propose a change to this suite, InnerSource style: anyone may contribute, the owning team reviews and decides.
Setup is in [`ONBOARDING.md`](https://github.com/kengsenghor/playwright-auth-flows-demo/blob/main/docs/ONBOARDING.md); the design rules are in [`ARCHITECTURE.md`](https://github.com/kengsenghor/playwright-auth-flows-demo/blob/main/docs/ARCHITECTURE.md).

## 1. Before you start

- Read the layer rules in `ARCHITECTURE.md` §1. They are enforced in review.
- For anything bigger than a small fix (new flow, new dependency, a change to the captcha or CI policy), open an issue
  first and describe the problem, your proposal and the trade-offs. A decision that changes the architecture gets a new
  ADR in `ARCHITECTURE.md`.
- The suite hits the live production site. Do not add loops, `--repeat-each`, or anything that creates accounts by default.

## 2. Workflow

1. Branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Make the change following [`ONBOARDING.md` §8](https://github.com/kengsenghor/playwright-auth-flows-demo/blob/main/docs/ONBOARDING.md) (page object → step → spec, next free scenario ID).
3. Verify locally:

   ```bash
   npm run typecheck
   npx playwright test -g "<your scenario ID>"
   npm run test:login        # or test:signup, whichever flow you touched
   ```

4. Commit with a short imperative message (`Fix login redirect wait`, not `fixed stuff`). One logical change per commit.
5. Push the branch and open a pull request against `main`.
6. Address review comments with new commits; the maintainer squashes or merges.

## 3. Pull request checklist

- [ ] `npm run typecheck` is clean.
- [ ] The affected flow passes locally, and you can explain every skip in the run summary.
- [ ] No `.only`, no `test.skip()` without a reason, no fixed sleeps, no XPath, no placeholder or stub tests.
- [ ] Layers respected: no locators or `expect` in specs; no assertions in page objects; no selectors in steps.
- [ ] No secrets, `.env`, or `.auth/` content in the diff (`git diff --cached` before committing).
- [ ] New scenarios have an ID in the title and are added to the README scenario table.
- [ ] You did not weaken or delete an assertion to make a failure go away.
- [ ] Docs updated if behaviour, commands, variables or CI changed.

## 4. Code standards

| Topic | Rule |
| --- | --- |
| Locators | `getByRole` with accessible name, then label, then stable id. No XPath or positional CSS. |
| Waits | Auto-waiting actions and web-first assertions. No fixed sleeps. |
| Assertions | Only in `steps/` (`ThenI…`). |
| Data | Generate emails with `TestDataHelper`; never hard-code. Negative signup cases create nothing. |
| Secrets | Read from the environment only. |
| Captcha | Never solved or bypassed in code. Skip with a reason, or use manual-assist locally. |
| Imports | Specs use the extended `test` from `fixtures/`, not `@playwright/test` directly. |
| Language | TypeScript, strict. Follow the surrounding file's style. |

## 5. Reviewing

Reviewers check, in order: correctness against the scenario, layer separation, flakiness risk, security (secrets,
account safety on production), then style. Approve only after you have read the diff, not just the description. The
author does not approve their own pull request.

## 6. Reporting problems

Open an issue with: what you ran, the scenario ID, expected vs actual, and the run summary. Attach the trace only if it
has been checked for credentials and the account email. Never paste `.env`, `.auth/user.json`, or secret values.

## 7. Terminology

Use **Software Test Engineer** for the role and **software testing** for the activity, in code, comments, commit messages
and issues.
