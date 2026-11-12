import { Locator, Page } from '@playwright/test';
import { environment } from '../data/environment';
import { PageHelper } from '../helper/page.helper';

/**
 * Auth0 universal login is identifier-first: step 1 = email/username -> Continue,
 * step 2 = password -> Sign in. Locators are role/label based (no brittle XPath/CSS chains).
 */
export default class LoginPage {
  private readonly page: Page;
  readonly heading: Locator;
  readonly identifierInput: Locator;
  readonly continueButton: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly keepMeSignedInCheckbox: Locator;
  readonly signUpLink: Locator;
  readonly googleButton: Locator;
  readonly appleButton: Locator;
  readonly visibleErrors: Locator;
  readonly captchaInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Welcome back' });
    this.identifierInput = page.getByRole('textbox', { name: /Email or username/i });
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.passwordInput = page.locator('#password');
    this.signInButton = page.getByRole('button', { name: 'Sign in', exact: true });
    this.keepMeSignedInCheckbox = page.locator('#keep-me-sign-in');
    this.signUpLink = page.getByRole('link', { name: 'Sign up' });
    this.googleButton = page.getByRole('button', { name: 'Continue with Google' });
    this.appleButton = page.getByRole('button', { name: 'Continue with Apple' });
    // Auth0 renders every possible message into the DOM and shows only the active ones.
    // Auth0 bot protection: shown in place of the password step after repeated automated attempts.
    this.captchaInput = page.getByRole('textbox', { name: /Enter the code shown above/i });
    this.visibleErrors = page.locator('.ulp-error-info:visible, .ulp-input-error-message:visible, [role="alert"]:visible');
  }

  async navigateToLoginPage() {
    await PageHelper.gotoAuth0Page(this.page, environment.loginUrlForEnv(process.env.ENV), this.identifierInput);
  }

  /** Waits until the flow shows either the password field or the captcha that replaces it. */
  async waitForPasswordOrCaptcha() {
    await this.passwordInput.or(this.captchaInput).first().waitFor({ state: 'visible' });
  }

  async isCaptchaVisible(): Promise<boolean> {
    const isCaptchaVisible = await this.captchaInput.isVisible();
    return isCaptchaVisible;
  }

  async waitForPasswordStep(timeout: number) {
    await this.passwordInput.waitFor({ state: 'visible', timeout });
  }

  async enterIdentifier(identifier: string) {
    await this.identifierInput.fill(identifier);
  }

  async clickContinue() {
    await this.continueButton.click();
  }

  async enterPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async clickSignIn() {
    await this.signInButton.click();
  }

  /**
   * Clicks a social button and returns the host of the first request that leaves the site for the provider.
   * The provider host is answered with an empty page, so the run never loads Google or Apple (it only observes the
   * hand-off): the suite must not drive any site but the configured one.
   */
  async clickSocialAndGetProviderHost(provider: 'Google' | 'Apple', providerHost: string): Promise<string> {
    await this.page.route(url => url.hostname === providerHost, route => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    const handOff = this.page.waitForRequest(request => new URL(request.url()).hostname === providerHost);
    await (provider === 'Google' ? this.googleButton : this.appleButton).click();
    return new URL((await handOff).url()).hostname;
  }

  async clickSignUpLink() {
    await this.signUpLink.click();
  }
}
