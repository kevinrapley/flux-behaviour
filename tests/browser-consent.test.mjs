import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('browser tracker creates and clears persistent identifiers only through consent lifecycle hooks', () => {
  const source = readFileSync('public/assets/flux/sdk/flux-browser.mjs', 'utf8');
  assert.match(source, /sessionIdFactory: \(\) => persistentSessionId\(windowLike\)/);
  assert.match(source, /visitorIdFactory: \(\) => persistentVisitorId\(windowLike\)/);
  assert.match(source, /clearPersistentIdentifiers\(windowLike\)/);
  assert.doesNotMatch(source, /sessionId: config\.sessionId \?\? persistentSessionId/);
});

test('auto-capture does not derive element keys from accessible labels', () => {
  const source = readFileSync('public/assets/flux/sdk/flux-auto-capture.mjs', 'utf8');
  assert.doesNotMatch(source, /getAttribute\('aria-label'\)/);
  assert.match(source, /element\.dataset\.fluxKey/);
});
