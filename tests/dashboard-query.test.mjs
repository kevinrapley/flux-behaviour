import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard selects the newest events before restoring chronological journey order', () => {
  const source = readFileSync('src/product/router.mjs', 'utf8');
  assert.match(source, /ORDER BY e\.occurred_at_ms DESC LIMIT 500\) ORDER BY occurred_at_ms ASC/);
});

test('auto-capture excludes sensitive and one-time-code inputs', () => {
  const source = readFileSync('src/sdk/flux-auto-capture.mjs', 'utf8');
  assert.match(source, /\['password', 'email', 'tel'\]/);
  assert.match(source, /\['one-time-code', 'current-password', 'new-password'\]/);
});
