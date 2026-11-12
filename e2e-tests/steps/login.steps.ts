import { expect, Page } from '@playwright/test';
import { test } from '../fixtures/test-data.fixture';
import LoginPage from '../pages/login.page';
import { environment } from '../data/environment';
import { PageHelper } from '../helper/page.helper';

export default class LoginSteps {
  private readonly page: Page;
  private readonly loginPage: LoginPage;
  private providerHost = '';

  constructor(page: Page) {
    this.page = page;
    this.loginPage = new LoginPage(page);
  }

  async GivenINavigateToLoginPage() {
    await this.loginPage.navigateToLoginPage();
  }

  /** Fresh login as a precondition for other specs: Given steps may call page methods and private helpers only. */
  async GivenIAmLoggedInAs(username: string, password: string) {
    await this.loginPage.navigateToLoginPage();
    await this.submitIdentifier(username);
    await this.submitPassword(password);
    await PageHelper.waitForRedirect(this.page, environment.appHostPattern);
  }

  /** Opens the app directly; a saved session (storageState) means no login form and no captcha. */
  async GivenIOpenTheAppWithASavedSession() {
    await this.page.goto(environment.appUrl, { waitUntil: 'domcontentloaded' });
  }

  async WhenISubmitIdentifier(identifier: string) {
    await this.submitIdentifier(identifier);
  }

  async WhenIClickContinueWithoutIdentifier() {
    await this.loginPage.clickContinue();
  }

  async WhenISubmitPassword(password: string) {
    await this.submitPassword(password);
  }

  /** Reusable across specs: the whole identifier -> password journey in one step. */
  async WhenILoginWith(username: string, password: string) {
    await this.submitIdentifier(username);
    await this.submitPassword(password);
  }

  private async submitIdentifier(identifier: string) {
    await this.loginPage.enterIdentifier(identifier);
    await this.loginPage.clickContinue();
  }

  private async submitPassword(password: string) {
    // Race password vs captcha so a bot-protection challenge is recognised immediately instead of
    // surfacing as a 15s "#password not found" timeout that looks like a broken locator.
    await this.loginPage.waitForPasswordOrCaptcha();
    if (await this.loginPage.isCaptchaVisible()) {
      // The captcha is deliberately not bypassed by code. Either a person solves it (MANUAL_CAPTCHA=1, headed),
      // or the test is reported as SKIPPED (not passed). The real fix is an allow-listed test account / tenant.
      test.skip(
        !PageHelper.manualCaptchaAvailable(),
        'The site showed a captcha (Auth0 bot protection) - fresh logins are not automated. Run "npm run test:login:manual" to solve it by hand'
      );
      PageHelper.allowManualCaptchaTime();
      PageHelper.promptManualCaptcha('Solve it in the browser window and click Continue.');
      await this.loginPage.waitForPasswordStep(PageHelper.manualCaptchaWaitMs);
    }
    await this.loginPage.enterPassword(password);
    await this.loginPage.clickSignIn();
  }

  async ThenIShouldSeeTheLoginForm() {
    await expect(this.page).toHaveURL(environment.ssoHostPattern);
    await expect(this.loginPage.identifierInput).toBeVisible();
    await expect(this.loginPage.continueButton).toBeVisible();
    await expect(this.loginPage.googleButton).toBeVisible();
    await expect(this.loginPage.appleButton).toBeVisible();
  }

  /**
   * Empty identifier is rejected either by Auth0's own error element or, when the page shows a captcha field,
   * by the browser's native required-field validation (no Auth0 element renders in that case).
   */
  async ThenTheEmptyIdentifierShouldBeRejected() {
    await expect(async () => {
      const nativelyInvalid = await this.loginPage.identifierInput.evaluate(el => !(el as HTMLInputElement).validity.valid);
      const auth0Error = await this.loginPage.visibleErrors.first().isVisible();
      expect(nativelyInvalid || auth0Error).toBe(true);
    }).toPass();
  }

  async ThenIShouldSeeAValidationError() {
    await expect(this.loginPage.visibleErrors.first()).toBeVisible();
  }

  async ThenIShouldRemainOnTheLoginPage() {
    await expect(this.page).toHaveURL(environment.ssoHostPattern);
    await expect(this.page).not.toHaveURL(environment.appHostPattern);
  }

  async ThenIShouldBeLoggedIn() {
    // Redirect after auth is async: wait on the URL, not on a fixed sleep.
    await PageHelper.waitForRedirect(this.page, environment.appHostPattern);
    await expect(this.page).not.toHaveURL(environment.ssoHostPattern);
  }

  /**
   * Same check as ThenIShouldBeLoggedIn, but an expired or revoked saved session is named as such. It is a failure, not
   * a skip: a skip would also hide a genuine regression where valid sessions stop working.
   */
  async ThenTheSavedSessionShouldBeAccepted() {
    try {
      await this.ThenIShouldBeLoggedIn();
    } catch (error) {
      if (environment.ssoHostPattern.test(this.page.url())) {
        throw new Error(
          `The saved session (${environment.sessionFile}) was sent back to the login page: it has expired or been revoked. ` +
            'Create a new one with "npm run auth:save" (or update the CI secret file).'
        );
      }
      throw error;
    }
  }

  async WhenIContinueWithProvider(provider: 'Google' | 'Apple', providerHost: string) {
    this.providerHost = await this.loginPage.clickSocialAndGetProviderHost(provider, providerHost);
  }

  /**
   * The identifier step rejects the value on format alone; no password step is reached. While Auth0's bot protection
   * shows a captcha, it answers "Please enter captcha code" instead, so the format rule cannot be observed: that is a
   * skip with a reason (not verified), never a pass and never a bypass.
   */
  async ThenTheIdentifierFormatShouldBeRejected() {
    const formatError = this.loginPage.visibleErrors.filter({ hasText: /Username can only contain alphanumeric characters/i });
    await expect(formatError.or(this.loginPage.captchaInput).first()).toBeVisible();
    test.skip(
      await this.loginPage.isCaptchaVisible(),
      'The site showed a captcha (Auth0 bot protection), which replaces the identifier format message; the rule was not verified'
    );
    await expect(formatError.first()).toBeVisible();
    await expect(this.page).toHaveURL(/\/u\/login\/identifier/);
  }

  async ThenIShouldBeSentToTheProvider(expectedHost: string) {
    expect(this.providerHost).toBe(expectedHost);
  }

  async WhenIClickSignUpLink() {
    await this.loginPage.clickSignUpLink();
  }

  async ThenIShouldBeOnTheSignupPage() {
    await expect(this.page).toHaveURL(/\/u\/signup\//);
  }
}
