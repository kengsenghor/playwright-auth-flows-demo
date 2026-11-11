// The site under test is configured, not hard-coded. Set both variables in .env (see .env.example).
//   TARGET_APP_URL  origin of the application whose signup and login are tested, e.g. https://app.example.com
//   TARGET_SSO_URL  origin of the Auth0 universal-login host those pages redirect to, e.g. https://sso.example.com
function origin(name: 'TARGET_APP_URL' | 'TARGET_SSO_URL'): string {
  const value = (process.env[name] ?? '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+$/.test(value)) {
    throw new Error(`${name} must be set to an https origin without a path (for example https://app.example.com). See .env.example.`);
  }
  return value;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class environment {
  public static get appOrigin() {
    return origin('TARGET_APP_URL');
  }

  public static get signupUrl() {
    return `${environment.appOrigin}/en?screen_hint=signup`;
  }

  public static get loginUrl() {
    return `${environment.appOrigin}/en/inbox?screen_hint=login`;
  }

  public static get appUrl() {
    return `${environment.appOrigin}/en/inbox`;
  }

  // Saved authenticated session (created once by `npm run auth:save`; git-ignored). CI can point
  // AUTH_STORAGE_STATE at a secret file instead.
  public static sessionFile = process.env.AUTH_STORAGE_STATE || '.auth/user.json';

  // Auth0 universal-login host the two entry URLs redirect to.
  // Anchored to the host: the SSO URL carries the app URL in its query string, which an unanchored pattern would match.
  public static get ssoHostPattern() {
    return new RegExp(`^${escapeRegExp(origin('TARGET_SSO_URL'))}/`);
  }

  public static get appHostPattern() {
    return new RegExp(`^${escapeRegExp(environment.appOrigin)}/`);
  }

  public static signupUrlForEnv(env: string | undefined) {
    return environment.signupUrl; // single environment; extend here for staging
  }

  public static loginUrlForEnv(env: string | undefined) {
    return environment.loginUrl;
  }
}
