import { Locator, Page } from '@playwright/test';
import { environment } from '../data/environment';
import { PageHelper } from '../helper/page.helper';

export default class SignupPage {
  private readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly termsCheckbox: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;
  readonly signUpButton: Locator;
  readonly signInLink: Locator;
  readonly googleButton: Locator;
  readonly appleButton: Locator;
  readonly visibleErrors: Locator;
  readonly captchaChallenge: Locator;
  readonly termsError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Create your account' });
    this.emailInput = page.getByRole('textbox', { name: /Email address/i });
    this.passwordInput = page.getByRole('textbox', { name: /^Password/i });
    this.termsCheckbox = page.getByRole('checkbox');
    this.termsLink = page.getByRole('link', { name: 'Terms of Service' });
    this.privacyLink = page.getByRole('link', { name: 'Privacy Policy' }).first();
    this.signUpButton = page.getByRole('button', { name: 'Sign up', exact: true });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.googleButton = page.getByRole('button', { name: 'Continue with Google' });
    this.appleButton = page.getByRole('button', { name: 'Continue with Apple' });
    // Auth0 marks the field container of the unticked terms box with `ulp-error` when the submit is rejected.
    this.termsError = page.locator('.ulp-field.ulp-error', { has: page.getByRole('checkbox') });
    this.captchaChallenge = page.getByText(/Enter the code shown above/i);
    this.visibleErrors = page.locator('.ulp-error-info:visible, .ulp-input-error-message:visible, [role="alert"]:visible');
  }

  async navigateToSignupPage() {
    await PageHelper.gotoAuth0Page(this.page, environment.signupUrlForEnv(process.env.ENV), this.emailInput);
  }

  async enterEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async acceptTerms() {
    // Custom-styled checkbox: its <label> overlays the real <input>, so Playwright's actionability check
    // reports "label intercepts pointer events". force skips that check; check() still verifies the end state.
    // A forced click can land before the page's script has wired up the custom checkbox, in which case the
    // state does not change. Retry the click until the box is really checked.
    const deadline = Date.now() + 15_000;
    for (;;) {
      try {
        await this.termsCheckbox.check({ force: true, timeout: 2_000 });
        return;
      } catch (error) {
        if (Date.now() >= deadline) throw error;
      }
    }
  }

  /** Waits for the site's answer to a submit: true when it showed a captcha, false when it moved to the password step. */
  async waitForPasswordStepOrCaptcha(): Promise<boolean> {
    const advanced = this.page.waitForURL(/\/u\/signup\/password/, { timeout: 15_000 }).then(() => false);
    const challenged = this.captchaChallenge.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true);
    try {
      return await Promise.any([advanced, challenged]);
    } catch (error) {
      // Promise.any rejects with an AggregateError only when neither happened in time: no captcha, no advance.
      if (error instanceof AggregateError) return false;
      throw error;
    }
  }

  async waitForPasswordStep(timeout: number) {
    await this.page.waitForURL(/\/u\/signup\/password/, { timeout });
  }

  async clickSignUp() {
    await this.signUpButton.click();
  }

  async clickSignInLink() {
    await this.signInLink.click();
  }
}
