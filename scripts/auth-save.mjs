// Opens a browser so a person can log in by hand and saves the session to .auth/user.json (git-ignored, live tokens).
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const app = (process.env.TARGET_APP_URL ?? '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[^/\s]+$/.test(app)) {
  console.error('Set TARGET_APP_URL in .env first (for example https://app.example.com).');
  process.exit(1);
}
const result = spawnSync(
  'npx',
  ['playwright', 'codegen', '--save-storage=.auth/user.json', `${app}/en/inbox?screen_hint=login`],
  { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
