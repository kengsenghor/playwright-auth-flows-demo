import { test as base, TestInfo } from '@playwright/test';

/** Records every identity a test creates, so the run report shows exactly what was left behind. */
export class TestDataRegistry {
  private readonly emails: string[] = [];
  registerEmail(email: string) {
    this.emails.push(email);
  }
  isEmpty() {
    return this.emails.length === 0;
  }
  createdEmails() {
    return [...this.emails];
  }
}

interface AuthFixtures {
  testData: TestDataRegistry;
}

/**
 * Extended `test` with test-data bookkeeping. The public site exposes no delete-account API, so
 * "cleanup" here means: (1) never create more than needed (negative signup cases stop before
 * submit), (2) use plus-addressed emails into one controlled inbox, and (3) annotate every created
 * identity so a cleanup job / the tenant admin can purge them by the `+su` tag.
 */
/** Third-party analytics/ads hosts: irrelevant to the flows under test and they slow or stall page load. */
const BLOCKED_HOSTS = /(^|\.)(doubleclick\.net|googleadservices\.com|facebook\.(com|net)|ads\.linkedin\.com|bing\.com|tiktok\.com|g2\.com|claydar\.com)$/i;

export const test = base.extend<AuthFixtures>({
  page: async ({ page }, use) => {
    await page.route(url => BLOCKED_HOSTS.test(url.hostname), route => route.abort());
    await use(page);
  },
  testData: [
    async ({}, use, testInfo: TestInfo) => {
      const registry = new TestDataRegistry();
      await use(registry);
      for (const email of registry.createdEmails()) {
        testInfo.annotations.push({ type: 'test-data-created', description: email });
      }
    },
    { auto: true }
  ]
});

export { expect } from '@playwright/test';
