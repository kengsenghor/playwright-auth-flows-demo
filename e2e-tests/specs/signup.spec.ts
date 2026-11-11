import { test } from '../fixtures/test-data.fixture';
import SignupSteps from '../steps/signup.steps';
import { signup } from '../data/signup';
import { TestDataHelper } from '../helper/test-data.helper';

const suiteTitle = 'Signup UI Tests';
let signupSteps: SignupSteps;

test.describe(suiteTitle, () => {
  test.beforeEach(async ({ page, testData }) => {
    signupSteps = new SignupSteps(page, testData);
    await signupSteps.GivenINavigateToSignupPage();
  });

  test('AF-SIGNUP-01 Signup page shows the form, legal links and social options', async () => {
    await signupSteps.ThenIShouldSeeTheSignupForm();
  });

  test('AF-SIGNUP-02 Submitting an empty form is rejected', async () => {
    await signupSteps.WhenIClickSignUp();
    await signupSteps.ThenIShouldSeeAValidationError();
    await signupSteps.ThenIShouldRemainOnTheSignupStep();
  });

  // Negative cases stop before a valid submit, so they never create an account.
  for (const email of signup.invalidEmails) {
    test(`AF-SIGNUP-03 Invalid email is rejected: "${email}"`, async () => {
      await signupSteps.WhenIEnterEmail(email);
      await signupSteps.WhenIAcceptTheTerms();
      await signupSteps.WhenIClickSignUp();
      await signupSteps.ThenIShouldSeeAValidationError();
      await signupSteps.ThenIShouldRemainOnTheSignupStep();
    });
  }

  test('AF-SIGNUP-04 Valid email without accepting the terms is rejected', async () => {
    // History: on 2026-11-09 the site advanced to /u/signup/password with the terms box unticked, so this case was
    // `fixme`. On 2026-11-10 it rejects the submit and flags the terms field, so it is a normal test again. If the
    // old behaviour returns, this fails on the visible terms error, which is the signal to raise it with product.
    await signupSteps.WhenIEnterEmail('test.terms.check@example.com');
    await signupSteps.WhenIClickSignUp();
    await signupSteps.ThenTheTermsShouldBeRequired();
  });

  test('AF-SIGNUP-05 Sign in link navigates to the login form', async () => {
    await signupSteps.WhenIClickSignInLink();
    await signupSteps.ThenIShouldBeOnTheLoginPage();
  });

  test('AF-SIGNUP-06 New user can start signup with a unique email', async () => {
    test.skip(!signup.liveSignupEnabled(), 'Live signup submits a real signup: set RUN_LIVE_SIGNUP=1 to run it');
    test.skip(!signup.hasBaseEmail(), 'Set SIGNUP_BASE_EMAIL (a mailbox you control) to run live signup');
    const email = TestDataHelper.uniqueEmail(signup.baseEmail);
    await signupSteps.WhenISignUpWithNewEmail(email);
    await signupSteps.ThenIShouldMoveToTheNextSignupStep();
  });
});
