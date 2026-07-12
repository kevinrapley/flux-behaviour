import { createFluxTag } from './flux-tag.mjs';

/**
 * Browser wiring for the Flux tag.
 *
 * Services add a GA-style snippet that queues commands before the module
 * loads, then this module drains the queue:
 *
 *   window.flux = window.flux || function () {
 *     (window.flux.q = window.flux.q || []).push(arguments);
 *   };
 *   flux('consent', 'granted');
 *   flux('event', 'nav', 'page.loaded', { role: 'page', element_key: 'start' });
 *
 * Consent is never assumed. Until `flux('consent', 'granted')` runs, every
 * event command is dropped without being stored or sent.
 */
export function installFluxBrowserTag(windowLike, config = {}) {
  if (!windowLike || typeof windowLike !== 'object') {
    throw new TypeError('installFluxBrowserTag requires a window-like object.');
  }

  const endpoint = config.endpoint ?? readEndpointFromScript(windowLike);
  const transport = config.transport ?? createBrowserTransport(windowLike);

  const tag = createFluxTag({
    endpoint,
    transport,
    sessionId: config.sessionId,
    visitorId: config.visitorId,
    sessionIdFactory: () => persistentSessionId(windowLike, config.now),
    visitorIdFactory: () => persistentVisitorId(windowLike),
    resetIdentifiers: () => clearPersistentIdentifiers(windowLike),
    tenantId: config.tenantId ?? readTenantFromScript(windowLike),
    consent: config.consent,
    now: config.now,
    onDrop: config.onDrop,
    randomSource: config.randomSource
  });

  const pending = Array.isArray(windowLike.flux?.q) ? windowLike.flux.q.slice() : [];

  const command = (...args) => runCommand(tag, args);
  command.q = [];
  windowLike.flux = command;

  for (const args of pending) {
    runCommand(tag, Array.from(args));
  }

  return tag;
}

function runCommand(tag, args) {
  const [name, ...rest] = args;

  if (name === 'consent') {
    if (rest[0] === 'granted') tag.grantConsent();
    if (rest[0] === 'revoked') tag.revokeConsent();
    return;
  }

  if (name === 'event') {
    const [eventClass, action, details] = rest;
    void tag.track(eventClass, action, details);
  }
}

function readEndpointFromScript(windowLike) {
  // document.currentScript is null for module scripts, so fall back to the
  // first script tag carrying the data attribute.
  const script = windowLike.document?.currentScript
    ?? windowLike.document?.querySelector?.('script[data-flux-endpoint]');
  const endpoint = script?.dataset?.fluxEndpoint;
  return typeof endpoint === 'string' && endpoint !== '' ? endpoint : null;
}

function readTenantFromScript(windowLike) {
  const script = windowLike.document?.currentScript
    ?? windowLike.document?.querySelector?.('script[data-flux-tenant]');
  return script?.dataset?.fluxTenant ?? null;
}

function persistentVisitorId(windowLike) {
  return persistentIdentifier(windowLike.localStorage, 'flux.behaviour.visitor_id', 'visitor', windowLike);
}

function persistentSessionId(windowLike, now = Date.now) {
  const storage = windowLike.sessionStorage;
  const currentTime = typeof now === 'function' ? now() : Date.now();
  const existing = storage?.getItem('flux.behaviour.session_id');
  const lastActivity = Number(storage?.getItem('flux.behaviour.session_activity_ms'));
  if (existing && Number.isFinite(lastActivity) && lastActivity > 0 && currentTime - lastActivity < 30 * 60 * 1000) {
    storage?.setItem('flux.behaviour.session_activity_ms', currentTime);
    return existing;
  }
  const id = `session-${randomSuffix(windowLike)}`;
  storage?.setItem('flux.behaviour.session_id', id);
  storage?.setItem('flux.behaviour.session_activity_ms', currentTime);
  return id;
}

function persistentIdentifier(storage, key, prefix, windowLike) {
  const existing = storage?.getItem(key);
  if (existing) return existing;
  const id = `${prefix}-${randomSuffix(windowLike)}`;
  storage?.setItem(key, id);
  return id;
}

function clearPersistentIdentifiers(windowLike) {
  windowLike.localStorage?.removeItem('flux.behaviour.visitor_id');
  windowLike.sessionStorage?.removeItem('flux.behaviour.session_id');
  windowLike.sessionStorage?.removeItem('flux.behaviour.session_activity_ms');
}

function randomSuffix(windowLike) {
  if (typeof windowLike.crypto?.randomUUID === 'function') return windowLike.crypto.randomUUID().replace(/-/g, '');
  const bytes = new Uint8Array(16);
  if (typeof windowLike.crypto?.getRandomValues === 'function') {
    windowLike.crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2).padEnd(24, '0');
}

export function createBrowserTransport(windowLike) {
  return async ({ endpoint, body }) => {
    // Prefer fetch with keepalive: true and credentials: 'omit' to ensure credentials are not sent.
    if (typeof windowLike.fetch === 'function') {
      try {
        await windowLike.fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
          credentials: 'omit'
        });
        return;
      } catch (err) {
        // Fall back to sendBeacon if fetch fails (e.g. keepalive size limits or network issue).
      }
    }

    const navigatorLike = windowLike.navigator;
    if (navigatorLike && typeof navigatorLike.sendBeacon === 'function') {
      const payload = new windowLike.Blob([body], { type: 'application/json' });
      if (navigatorLike.sendBeacon(endpoint, payload)) {
        return;
      }
    }
  };
}
