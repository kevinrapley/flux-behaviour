import test from 'node:test';
import assert from 'node:assert/strict';
import { createFluxTag, generateSessionId } from '../src/sdk/flux-tag.mjs';
import { installFluxBrowserTag, createBrowserTransport } from '../src/sdk/flux-browser.mjs';
import { fluxEventSchema } from '../src/events/flux-event-schema.mjs';
import { validateEventRuntime } from '../src/events/validate-event-runtime.mjs';

function createCapturingTransport() {
  const sent = [];
  const transport = async ({ endpoint, body }) => {
    sent.push({ endpoint, body: JSON.parse(body) });
  };
  return { sent, transport };
}

function createTag(overrides = {}) {
  const { sent, transport } = createCapturingTransport();
  const tag = createFluxTag({
    endpoint: 'https://collector.example.test/collect',
    sessionId: 'test-session-0001',
    transport,
    now: () => 1750000000000,
    ...overrides
  });
  return { tag, sent };
}

test('sdk tag drops events until consent is granted', async () => {
  const drops = [];
  const { tag, sent } = createTag({ onDrop: (drop) => drops.push(drop) });

  const result = await tag.track('nav', 'page.loaded', { role: 'page', element_key: 'start' });

  assert.deepEqual(result, { sent: false, reason: 'no_consent' });
  assert.equal(sent.length, 0);
  assert.equal(drops[0].reason, 'no_consent');
});

test('sdk tag sends a contract-valid event after consent', async () => {
  const { tag, sent } = createTag();
  tag.grantConsent();

  const result = await tag.track('focus', 'field.focus', {
    role: 'field',
    element_key: 'full-name',
    duration_ms: 1200
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].endpoint, 'https://collector.example.test/collect');

  const validation = validateEventRuntime(sent[0].body, fluxEventSchema);
  assert.equal(validation.valid, true);
  assert.equal(sent[0].body.origin, 'sdk');
  assert.equal(sent[0].body.consent, 'yes');
  assert.equal(sent[0].body.timestamp_ms, 1750000000000);
});

test('sdk tag revoking consent stops sending', async () => {
  const { tag, sent } = createTag();
  tag.grantConsent();
  tag.revokeConsent();

  const result = await tag.track('nav', 'page.loaded', { role: 'page', element_key: 'start' });

  assert.equal(result.sent, false);
  assert.equal(sent.length, 0);
});

test('sdk tag strips fields outside the metadata allowlist', async () => {
  const { tag, sent } = createTag();
  tag.grantConsent();

  await tag.track('input', 'field.updated', {
    role: 'field',
    element_key: 'full-name',
    value_length: 12,
    value: 'Ada Lovelace',
    email: 'ada@example.test',
    nested: { anything: true }
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.value_length, 12);
  assert.equal('value' in sent[0].body, false);
  assert.equal('email' in sent[0].body, false);
  assert.equal('nested' in sent[0].body, false);
});

test('sdk tag drops contract-invalid events instead of sending', async () => {
  const drops = [];
  const { tag, sent } = createTag({ onDrop: (drop) => drops.push(drop) });
  tag.grantConsent();

  const result = await tag.track('surveillance', 'watch.user', {
    role: 'field',
    element_key: 'full-name'
  });

  assert.deepEqual(result, { sent: false, reason: 'invalid_event' });
  assert.equal(sent.length, 0);
  assert.equal(drops[0].reason, 'invalid_event');
});

test('sdk tag reports transport failure without throwing', async () => {
  const tag = createFluxTag({
    endpoint: 'https://collector.example.test/collect',
    sessionId: 'test-session-0001',
    consent: 'yes',
    transport: async () => {
      throw new Error('network down');
    }
  });

  const result = await tag.track('nav', 'page.loaded', { role: 'page', element_key: 'start' });

  assert.deepEqual(result, { sent: false, reason: 'transport_failed' });
});

test('generated session ids satisfy the event contract', () => {
  const sessionId = generateSessionId();
  const schemaPattern = new RegExp(fluxEventSchema.properties.session_id.pattern);

  assert.equal(schemaPattern.test(sessionId), true);
  assert.equal(sessionId.length >= 8 && sessionId.length <= 128, true);
});

test('generated session ids use custom randomSource when provided', () => {
  const customRandom = () => 0.5; // maps to index 18 in alphabet -> 's'
  const sessionId = generateSessionId(customRandom);
  assert.equal(sessionId, 'flux-ssssssssssssssssssssssss');
});

test('generated session ids use secure crypto when crypto is available', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let getRandomValuesCalled = false;

  const mockCrypto = {
    getRandomValues: (array) => {
      getRandomValuesCalled = true;
      array.fill(0); // 0 / 4294967296 = 0 -> alphabet[0] = 'a'
      return array;
    }
  };

  Object.defineProperty(globalThis, 'crypto', {
    value: mockCrypto,
    configurable: true,
    writable: true
  });

  try {
    const sessionId = generateSessionId();
    assert.equal(getRandomValuesCalled, true);
    assert.equal(sessionId, 'flux-aaaaaaaaaaaaaaaaaaaaaaaa');
  } finally {
    if (originalCrypto) {
      Object.defineProperty(globalThis, 'crypto', originalCrypto);
    } else {
      delete globalThis.crypto;
    }
  }
});

test('browser tag drains the pre-install command queue in order', async () => {
  const { sent, transport } = createCapturingTransport();
  const queue = [
    ['consent', 'granted'],
    ['event', 'nav', 'page.loaded', { role: 'page', element_key: 'start' }]
  ];
  const windowLike = { flux: Object.assign(() => {}, { q: queue }) };

  installFluxBrowserTag(windowLike, {
    endpoint: 'https://collector.example.test/collect',
    transport
  });
  await Promise.resolve();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.action, 'page.loaded');
});

test('browser tag reads the endpoint from the script dataset', async () => {
  const { sent, transport } = createCapturingTransport();
  const windowLike = {
    document: {
      currentScript: {
        dataset: { fluxEndpoint: 'https://collector.example.test/collect' }
      }
    }
  };

  installFluxBrowserTag(windowLike, { transport });
  windowLike.flux('consent', 'granted');
  windowLike.flux('event', 'nav', 'page.loaded', { role: 'page', element_key: 'start' });
  await Promise.resolve();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].endpoint, 'https://collector.example.test/collect');
});

test('browser transport prefers fetch and falls back to sendBeacon', async () => {
  const beaconCalls = [];
  const fetchCalls = [];

  // 1. fetch is available and succeeds: sendBeacon must not be called
  const fetchWindow = {
    Blob,
    navigator: {
      sendBeacon: (endpoint, payload) => {
        throw new Error('sendBeacon should not run when fetch succeeds');
      }
    },
    fetch: async (endpoint, init) => {
      fetchCalls.push({ endpoint, init });
      return { ok: true };
    }
  };

  await createBrowserTransport(fetchWindow)({
    endpoint: 'https://collector.example.test/collect',
    body: '{"ok":true}'
  });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].init.method, 'POST');
  assert.equal(fetchCalls[0].init.headers['content-type'], 'application/json');
  assert.equal(fetchCalls[0].init.credentials, 'omit');
  assert.equal(fetchCalls[0].init.keepalive, true);

  // 2. fetch throws: falls back to sendBeacon
  const fallbackWindow = {
    Blob,
    navigator: {
      sendBeacon: (endpoint, payload) => {
        beaconCalls.push({ endpoint, payload });
        return true;
      }
    },
    fetch: async () => {
      throw new Error('fetch failed');
    }
  };

  await createBrowserTransport(fallbackWindow)({
    endpoint: 'https://collector.example.test/collect',
    body: '{"ok":true}'
  });
  assert.equal(beaconCalls.length, 1);
  assert.equal(beaconCalls[0].endpoint, 'https://collector.example.test/collect');

  // 3. fetch is not defined: falls back to sendBeacon
  const noFetchWindow = {
    Blob,
    navigator: {
      sendBeacon: (endpoint, payload) => {
        beaconCalls.push({ endpoint, payload });
        return true;
      }
    }
  };

  await createBrowserTransport(noFetchWindow)({
    endpoint: 'https://collector.example.test/collect',
    body: '{"ok":true}'
  });
  assert.equal(beaconCalls.length, 2);
});
