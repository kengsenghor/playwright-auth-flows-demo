import { expect, Page, test } from '@playwright/test';
import SignupPage from '../pages/signup.page';
import { environment } from '../data/environment';
import { PageHelper } from '../helper/page.helper';
import { TestDataRegistry } from '../fixtures/test-data.fixture';

export default class SignupSteps {
  private readonly page: Page;
  private readonly signupPage: SignupPage;
  private readonly testData: TestDataRegistry;

  constructor(page: Page, testData: TestDataRegistry) {
    this.page = page;
    this.signupPage = new SignupPage(page);
    this.testData = testData;
  }

  async GivenINavigateToSignupPage() {
    await this.signupPage.navigateToSignupPage();
  }

  async WhenIEnterEmail(email: string) {
    await this.signupPage.enterEmail(email);
  }

  async WhenIAcceptTheTerms() {
    await this.signupPage.acceptTerms();
  }

  async WhenIClickSignUp() {
    await this.signupPage.clickSignUp();
  }

  /**
   * Only call for emails you intend to create: it registers them in the test-data report.
   * Repeated automated signups can trigger the site's bot protection; that is reported as a skip, not a product failure.
   */
  async WhenISignUpWithNewEmail(email: string) {
    this.testData.registerEmail(email);
    await this.signupPage.enterEmail(email);
    await this.signupPage.acceptTerms();
    await this.signupPage.clickSignUp();
    await this.skipIfChallengedByCaptcha();
  }

  async WhenIClickSignInLink() {
    await this.signupPage.clickSignInLink();
  }

  async ThenIShouldSeeTheSignupForm() {
    await expect(this.page).toHaveURL(environment.ssoHostPattern);
    await expect(this.signupPage.heading).toBeVisible();
    await expect(this.signupPage.emailInput).toBeVisible();
    await expect(this.signupPage.termsCheckbox).not.toBeChecked();
    await expect(this.signupPage.termsLink).toHaveAttribute('href', /terms/);
    await expect(this.signupPage.privacyLink).toHaveAttribute('href', /privacy/);
    await expect(this.signupPage.googleButton).toBeVisible();
    await expect(this.signupPage.appleButton).toBeVisible();
  }

  async ThenIShouldSeeAValidationError() {
    await expect(this.signupPage.visibleErrors.first()).toBeVisible();
  }

  async ThenIShouldRemainOnTheSignupStep() {
    await expect(this.page).toHaveURL(/\/u\/signup\/identifier/);
  }

  async ThenIShouldMoveToTheNextSignupStep() {
    // Auto-retrying URL assertion absorbs the async redirect. Observed: email step -> password step.
    await expect(this.page).toHaveURL(/\/u\/signup\/password/);
    await expect(this.signupPage.passwordInput).toBeVisible();
  }

  /** Consent is enforced at the email step: the terms field is flagged and the user is not moved on. */
  async ThenTheTermsShouldBeRequired() {
    await expect(this.signupPage.termsError).toBeVisible();
    await expect(this.page).toHaveURL(/\/u\/signup\/identifier/);
  }

  async ThenIShouldBeOnTheLoginPage() {
    await expect(this.page).toHaveURL(/\/u\/login\//);
  }

  private async skipIfChallengedByCaptcha() {
    const challenged = await this.signupPage.waitForPasswordStepOrCaptcha();
    if (!challenged) return;
    if (PageHelper.manualCaptchaAvailable()) {
      // Manual-assist mode: a person solves the captcha in the open browser; then the flow continues.
      PageHelper.allowManualCaptchaTime();
      PageHelper.promptManualCaptcha('Solve it in the browser window and submit.');
      await this.signupPage.waitForPasswordStep(PageHelper.manualCaptchaWaitMs);
      return;
    }
    test.skip(true, 'Signup was challenged by a CAPTCHA; not a product failure');
  }
}
