import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleAuthorisationUrl } from '../src/product/google-oauth.mjs';
import { handleProductRequest } from '../src/product/router.mjs';

test('Google authorisation URL requests a verified OpenID email identity', () => {
  const url = new URL(buildGoogleAuthorisationUrl({
    clientId: 'client-id.apps.googleusercontent.com',
    redirectUri: 'https://flux-behaviour.pages.dev/api/auth/google/callback',
    state: 'state-token'
  }));

  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'client-id.apps.googleusercontent.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://flux-behaviour.pages.dev/api/auth/google/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('state'), 'state-token');
  assert.equal(url.searchParams.get('prompt'), 'select_account');
});

test('Google sign-in reports a safe configuration error before credentials exist', async () => {
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/auth/google/start'),
    { FLUX_DB: {} }
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'google_sign_in_unconfigured' });
});

test('Google sign-in binds the OAuth state to a signed HttpOnly cookie', async () => {
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/auth/google/start'),
    { FLUX_DB: {}, FLUX_AUTH_SECRET: 'test-secret', GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'client-secret' }
  );
  const location = new URL(response.headers.get('location'));
  const cookie = response.headers.get('set-cookie');

  assert.equal(response.status, 302);
  assert.match(location.searchParams.get('state'), /^[a-f0-9]{48}$/);
  assert.match(cookie, /^flux_google_state=[a-f0-9]{48}\.[a-f0-9]{64}; HttpOnly; Secure; SameSite=Lax;/);
  assert.notEqual(cookie.split('.')[0].split('=')[1], cookie.split('.')[1].split(';')[0]);
});

test('Google callback rejects an unsigned or mismatched state before contacting Google', async () => {
  const response = await handleProductRequest(
    new Request('https://flux-behaviour.pages.dev/api/auth/google/callback?code=code&state=attacker-state'),
    { FLUX_DB: {}, FLUX_AUTH_SECRET: 'test-secret', GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'client-secret' }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: 'google_sign_in_failed' });
});

test('Google callback binds the seeded account and starts a dashboard session', async () => {
  const env = { FLUX_DB: googleAccountDb(), FLUX_AUTH_SECRET: 'test-secret', GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'client-secret' };
  const start = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/auth/google/start'), env);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(JSON.stringify(
    String(url).includes('/token') ? { access_token: 'google-access-token' } : { sub: 'google-subject', email: 'digikev.kevin.rapley@gmail.com', email_verified: true }
  ), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    const response = await handleProductRequest(new Request(`https://flux-behaviour.pages.dev/api/auth/google/callback?code=google-code&state=${state}`, { headers: { cookie: start.headers.get('set-cookie') } }), env);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/dashboard/');
    assert.match(response.headers.get('set-cookie'), /^flux_session=seeded-account\.[0-9]+\.[a-f0-9]{64}; HttpOnly; Secure; SameSite=Lax;/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function googleAccountDb() {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => sql.includes('external_identities') ? null : (sql.includes('FROM accounts WHERE email') ? { id: 'seeded-account' } : null),
            run: async () => ({ success: true, meta: { changes: 1 }, values })
          };
        }
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); }
  };
}
