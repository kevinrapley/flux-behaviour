import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('account page provides Google sign-in without exposing OTP fields', () => {
  const page = readFileSync('public/account/index.html', 'utf8');

  assert.match(page, /href="\/api\/auth\/google\/start"/);
  assert.match(page, /Continue with Google/);
  assert.doesNotMatch(page, /One-time code/);
  assert.doesNotMatch(page, /otp-login/);
});

test('journey demo targets the live tenant-scoped collector', () => {
  const page = readFileSync('public/journey/index.html', 'utf8');
  assert.match(page, /data-flux-endpoint="https:\/\/flux-behaviour\.pages\.dev\/api\/collect"/);
  assert.match(page, /data-flux-tenant="researchops"/);
  assert.doesNotMatch(page, /127\.0\.0\.1:8787/);
});
