export class TestDataHelper {
  static uid(): string {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase();
  }

  /**
   * Plus-addressed variant of a mailbox the tester controls: test@x.com -> test+SU<uid>@x.com.
   * Every run gets a unique, traceable address that lands in ONE inbox, so there is no pile of
   * throwaway mailboxes to clean up and each signup email can be matched back to its test.
   */
  static uniqueEmail(baseEmail: string, tag = 'su'): string {
    const [local, domain] = baseEmail.split('@');
    return `${local}+${tag}${TestDataHelper.uid()}@${domain}`.toLowerCase();
  }
}
