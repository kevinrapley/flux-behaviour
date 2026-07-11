const form = document.querySelector('[data-flux-login-form]');
const status = document.querySelector('[data-flux-login-status]');
const email = document.querySelector('#email');
const code = document.querySelector('#code');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const endpoint = code.value ? '/api/auth/verify-otp' : '/api/auth/create-account';
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.value, code: code.value }) });
  const body = await response.json();
  if (body.ok && code.value) { location.assign('/dashboard/'); return; }
  status.textContent = body.ok ? 'Check your email for a six-digit code, then enter it below.' : 'We could not sign you in. Check the email and code, then try again.';
  if (body.ok) code.hidden = false;
});
