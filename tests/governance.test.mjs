import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('repository contract declares high public-service assurance posture', () => {
  const contract = readFileSync('repository-contract.yaml','utf8');
  assert.match(contract, /risk_level: high/);
  assert.match(contract, /public-service/);
});

test('GitHub settings require reviews and status checks', () => {
  const settings = readFileSync('github-settings.yaml','utf8');
  assert.match(settings, /require_pull_request_reviews: true/);
  assert.match(settings, /require_code_owner_reviews: true/);
  assert.match(settings, /CI \(Conformance\)/);
});

test('harm register blocks production release at foundation stage', () => {
  assert.match(readFileSync('harm-register.yaml','utf8'), /release_decision: blocked/);
});
