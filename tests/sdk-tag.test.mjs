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

test('browser transport prefers sendBeacon and falls back to fetch', async () => {
  const beaconCalls = [];
  const fetchCalls = [];

  const beaconWindow = {
    Blob,
    navigator: {
      sendBeacon: (endpoint, payload) => {
        beaconCalls.push({ endpoint, payload });
        return true;
      }
    },
    fetch: async () => {
      throw new Error('fetch should not run when sendBeacon succeeds');
    }
  };

  await createBrowserTransport(beaconWindow)({
    endpoint: 'https://collector.example.test/collect',
    body: '{"ok":true}'
  });
  assert.equal(beaconCalls.length, 1);

  const fallbackWindow = {
    Blob,
    navigator: { sendBeacon: () => false },
    fetch: async (endpoint, init) => {
      fetchCalls.push({ endpoint, init });
      return { ok: true };
    }
  };

  await createBrowserTransport(fallbackWindow)({
    endpoint: 'https://collector.example.test/collect',
    body: '{"ok":true}'
  });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].init.method, 'POST');
  assert.equal(fetchCalls[0].init.headers['content-type'], 'application/json');
  assert.equal(fetchCalls[0].init.credentials, 'omit');
});
