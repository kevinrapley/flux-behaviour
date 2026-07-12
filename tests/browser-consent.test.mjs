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

test('auto-capture consumes controlled page, role and sensitive attributes', () => {
  for (const path of ['src/sdk/flux-auto-capture.mjs', 'public/assets/flux/sdk/flux-auto-capture.mjs']) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /document\.body\?\.dataset\?\.fluxPage/);
    assert.match(source, /element\?\.dataset\?\.fluxRole/);
    assert.match(source, /element\?\.dataset\?\.fluxSensitive === 'true'/);
    assert.match(source, /AUTH_SCOPED_KEY = \/\(\^\|\[\.:-\]\)auth/);
    assert.match(source, /element\?\.closest\?\.\('form'\)/);
    assert.match(source, /closest\?\.\('\[data-flux-sensitive="true"\]'\)/);
    assert.match(source, /querySelectorAll\?\.\('\[data-flux-key\]'\)/);
    assert.match(source, /isSensitiveForm\(target\)/);
    assert.match(source, /`auto\.page\.\$\{key \|\| 'home'\}`/);
    assert.match(source, /changed \? \{ value_length:/);
  }
});
