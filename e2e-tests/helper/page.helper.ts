import { Locator, Page, test } from '@playwright/test';

export class PageHelper {
  /** Resolves once the page has settled on a URL matching `pattern` (redirect-safe, no fixed sleeps). */
  static async waitForRedirect(page: Page, pattern: RegExp, timeout = 30_000) {
    await page.waitForURL(pattern, { timeout, waitUntil: 'domcontentloaded' });
  }

  /**
   * Opens an Auth0 universal-login page and waits until it is really usable.
   * 'load' never fires within the timeout (analytics/chat scripts); the form is ready at DOMContentLoaded.
   * The SSO redirect (<sso host>/authorize) intermittently stalls, so the navigation is retried until `ready`
   * shows. A retry starts only while it can still finish inside the 120s test timeout (one attempt is at most 65s).
   */
  static async gotoAuth0Page(page: Page, url: string, ready: Locator) {
    const attempts = 3;
    const retryOnlyBeforeMs = 50_000;
    const startedAt = Date.now();
    for (let attempt = 1; ; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await ready.waitFor({ state: 'visible', timeout: 15_000 });
        // The Auth0 stylesheet (cdn.auth0.com) is sometimes very slow; until it lands, other controls (e.g. the
        // "Sign in" link) may not be matchable yet. Wait for every <link rel=stylesheet> to finish loading.
        await page.waitForFunction(
          () => [...document.querySelectorAll('link[rel="stylesheet"]')].every(l => (l as HTMLLinkElement).sheet),
          undefined,
          { timeout: 30_000 }
        );
        return;
      } catch (error) {
        if (attempt >= attempts || Date.now() - startedAt > retryOnlyBeforeMs) throw error;
      }
    }
  }

  /**
   * Manual-assist mode (MANUAL_CAPTCHA=1, headed only): when bot protection shows a captcha, the test waits for a
   * person to solve it in the open browser instead of skipping. The captcha is never solved or bypassed by code.
   * Returns false in headless runs / when the flag is off, so callers fall back to skipping.
   */
  static manualCaptchaAvailable(): boolean {
    return process.env.MANUAL_CAPTCHA === '1' && test.info().project.use.headless === false;
  }

  /** Extends the test timeout by the human wait so the 120s default doesn't cut the person off. */
  static allowManualCaptchaTime(ms = PageHelper.manualCaptchaWaitMs) {
    test.setTimeout(test.info().timeout + ms);
  }

  /** Tells the person at the keyboard what to do. A prompt for a human, not debug output, so it goes to stderr. */
  static promptManualCaptcha(whatToDo: string) {
    process.stderr.write(`\n>>> CAPTCHA: ${whatToDo} Waiting for the password step...\n`);
  }

  static readonly manualCaptchaWaitMs = 150_000;
}
