const GOOGLE_AUTHORISATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export function buildGoogleAuthorisationUrl({ clientId, redirectUri, state }) {
  const url = new URL(GOOGLE_AUTHORISATION_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  }).toString();
  return url.toString();
}
