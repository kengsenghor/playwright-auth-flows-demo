export class signup {
  public static baseEmail = process.env.SIGNUP_BASE_EMAIL ?? '';

  public static hasBaseEmail(): boolean {
    return signup.baseEmail.includes('@');
  }

  /** Live signup submits a real signup to the target environment, so it needs an explicit opt-in. */
  public static liveSignupEnabled(): boolean {
    return process.env.RUN_LIVE_SIGNUP === '1';
  }

  public static invalidEmails = ['plainaddress', 'missing-at.example.com', 'two@@example.com', 'spaces in@example.com', 'invalid@', '@gmail.com', 'invalid@gmail'];
}
