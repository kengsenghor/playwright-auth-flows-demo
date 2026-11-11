import { Page } from '@playwright/test';
import LoginSteps from './login.steps';

/** Shared, cross-spec journeys (mirrors CommonSteps in the reference framework). */
export default class CommonSteps {
  private readonly loginSteps: LoginSteps;

  constructor(page: Page) {
    this.loginSteps = new LoginSteps(page);
  }

  /** Precondition for any future post-login spec: reuse instead of re-writing the login clicks. */
  async GivenIAmLoggedInAs(username: string, password: string) {
    await this.loginSteps.GivenIAmLoggedInAs(username, password);
  }
}
