// Credentials come from the environment (.env locally, CI secrets in the pipeline) — never hardcoded.
export class login {
  public static validUsername = process.env.AUTH_TEST_USERNAME ?? '';
  public static validPassword = process.env.AUTH_TEST_PASSWORD ?? '';

  public static hasValidCredentials(): boolean {
    return !!login.validUsername && !!login.validPassword;
  }

  /** Identifiers the first step rejects on format alone, before any password step (so no login attempt is made). */
  public static invalidIdentifiers = ['123', 'abc', '@@@!!%%'];

  /** Social sign-in buttons and the host each one must hand off to. The browser is stopped before that host loads. */
  public static socialProviders = [
    { name: 'Google', host: 'accounts.google.com' },
    { name: 'Apple', host: 'appleid.apple.com' }
  ] as const;

  /** Invalid-credential matrix; the login flow is identifier-first, so these all reach the password step. */
  public static invalidCredentials = [
    { title: 'unknown user with wrong password', username: 'no.such.user.test@example.com', password: 'Wr0ng-Passw0rd!' },
    { title: 'malformed email with wrong password', username: 'not-an-email', password: 'Wr0ng-Passw0rd!' }
  ];
}
