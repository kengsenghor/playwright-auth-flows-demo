import * as fs from 'fs';
import { test } from '../fixtures/test-data.fixture';
import LoginSteps from '../steps/login.steps';
import { environment } from '../data/environment';

const hasSession = fs.existsSync(environment.sessionFile);

// A fresh login triggers Auth0's captcha (bot protection), which is deliberately not bypassed.
// A person logs in once (`npm run auth:save`, solving the captcha themselves) and the session is reused here.
test.describe('Login UI Tests (saved session)', () => {
  test.skip(!hasSession, `No saved session at ${environment.sessionFile}: run "npm run auth:save" and log in once`);
  test.use({ storageState: environment.sessionFile });

  test('AF-LOGIN-03 Valid session lands the user in the app', async ({ page }) => {
    const loginSteps = new LoginSteps(page);
    await loginSteps.GivenIOpenTheAppWithASavedSession();
    await loginSteps.ThenTheSavedSessionShouldBeAccepted();
  });
});
