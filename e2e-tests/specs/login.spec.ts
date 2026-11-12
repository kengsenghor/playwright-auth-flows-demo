import { test } from '../fixtures/test-data.fixture';
import LoginSteps from '../steps/login.steps';
import { login } from '../data/login';

const suiteTitle = 'Login UI Tests';
let loginSteps: LoginSteps;

test.describe(suiteTitle, () => {
  test.beforeEach(async ({ page }) => {
    loginSteps = new LoginSteps(page);
    await loginSteps.GivenINavigateToLoginPage();
  });

  test('AF-LOGIN-01 Login page shows the identifier form and social options', async () => {
    await loginSteps.ThenIShouldSeeTheLoginForm();
  });

  test('AF-LOGIN-02 Empty identifier is rejected with a validation error', async () => {
    await loginSteps.WhenIClickContinueWithoutIdentifier();
    await loginSteps.ThenTheEmptyIdentifierShouldBeRejected();
    await loginSteps.ThenIShouldRemainOnTheLoginPage();
  });

  // AF-LOGIN-03 (valid login) lives in login-session.spec.ts: a fresh login hits a captcha, so it reuses a saved session.

  for (const data of login.invalidCredentials) {
    test(`AF-LOGIN-04 Invalid credentials are rejected: ${data.title}`, async () => {
      await loginSteps.WhenILoginWith(data.username, data.password);
      await loginSteps.ThenIShouldSeeAValidationError();
      await loginSteps.ThenIShouldRemainOnTheLoginPage();
    });
  }

  test('AF-LOGIN-05 Valid email with a wrong password is rejected', async () => {
    test.skip(!login.hasValidCredentials(), 'Needs a real account to prove a wrong-password failure');
    await loginSteps.WhenILoginWith(login.validUsername, `${login.validPassword}-wrong`);
    await loginSteps.ThenIShouldSeeAValidationError();
    await loginSteps.ThenIShouldRemainOnTheLoginPage();
  });

  for (const identifier of login.invalidIdentifiers) {
    test(`AF-LOGIN-07 Identifier with an invalid format is rejected: "${identifier}"`, async () => {
      await loginSteps.WhenISubmitIdentifier(identifier);
      await loginSteps.ThenTheIdentifierFormatShouldBeRejected();
    });
  }

  for (const provider of login.socialProviders) {
    test(`AF-LOGIN-08 Continue with ${provider.name} hands off to the provider`, async () => {
      await loginSteps.WhenIContinueWithProvider(provider.name, provider.host);
      await loginSteps.ThenIShouldBeSentToTheProvider(provider.host);
    });
  }

  test('AF-LOGIN-06 Sign up link navigates to the signup form', async () => {
    await loginSteps.WhenIClickSignUpLink();
    await loginSteps.ThenIShouldBeOnTheSignupPage();
  });
});
