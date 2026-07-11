import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('live dashboard renders all-session and per-session dimension indicators with interpretation safeguards', () => {
  const source = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  assert.match(source, /Median demo-model indicators across these sessions/);
  assert.match(source, /not classifications or judgements of a person/);
  assert.match(source, /Show all 20 demo-model indicators for this session/);
  assert.match(source, /session\.dimension_scores/);
});
