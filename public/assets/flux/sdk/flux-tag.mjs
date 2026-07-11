import { fluxEventSchema } from '../events/flux-event-schema.mjs';
import { validateEventRuntime } from '../events/validate-event-runtime.mjs';

const SCHEMA_VERSION = '1.1.0';
const SDK_ORIGIN = 'sdk';

const OPTIONAL_METADATA_KEYS = Object.freeze([
  'value_length',
  'edit_count',
  'duration_ms',
  'reason',
  'navigation_direction',
  'pointer_type',
  'file_count',
  'file_size_bucket',
  'key_press_count',
  'backspace_count',
  'paste_count',
  'chars_per_minute',
  'revisit_count'
]);

/**
 * Create a runtime-neutral Flux tag.
 *
 * The tag never sends an event unless consent has been granted, and never
 * sends an event that fails the shared event contract. Anything outside the
 * optional metadata allowlist is discarded before validation so free text,
 * typed values and identifiers cannot leave the page.
 */
export function createFluxTag(options = {}) {
  const endpoint = typeof options.endpoint === 'string' ? options.endpoint : null;
  const transport = typeof options.transport === 'function' ? options.transport : null;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const onDrop = typeof options.onDrop === 'function' ? options.onDrop : () => {};
  const sessionId = typeof options.sessionId === 'string' && options.sessionId !== ''
    ? options.sessionId
    : generateSessionId(options.randomSource);
  const tenantId = typeof options.tenantId === 'string' ? options.tenantId : null;
  const visitorId = typeof options.visitorId === 'string' ? options.visitorId : null;

  let consentGranted = options.consent === 'yes';

  return {
    get sessionId() {
      return sessionId;
    },

    get hasConsent() {
      return consentGranted;
    },

    grantConsent() {
      consentGranted = true;
    },

    revokeConsent() {
      consentGranted = false;
    },

    async track(eventClass, action, details = {}) {
      if (!consentGranted) {
        onDrop({ reason: 'no_consent', event_class: eventClass, action });
        return { sent: false, reason: 'no_consent' };
      }

      if (!endpoint || !transport) {
        onDrop({ reason: 'not_configured', event_class: eventClass, action });
        return { sent: false, reason: 'not_configured' };
      }

      const event = buildEvent({ sessionId, tenantId, visitorId, eventClass, action, details, now });
      const validation = validateEventRuntime(event, fluxEventSchema);

      if (!validation.valid) {
        onDrop({ reason: 'invalid_event', event_class: eventClass, action });
        return { sent: false, reason: 'invalid_event' };
      }

      try {
        await transport({ endpoint, body: JSON.stringify(event) });
      } catch {
        onDrop({ reason: 'transport_failed', event_class: eventClass, action });
        return { sent: false, reason: 'transport_failed' };
      }

      return { sent: true };
    }
  };
}

export function generateSessionId(randomSource) {
  const random = typeof randomSource === 'function' ? randomSource : Math.random;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';

  while (suffix.length < 24) {
    suffix += alphabet[Math.floor(random() * alphabet.length)];
  }

  return `flux-${suffix}`;
}

function buildEvent({ sessionId, tenantId, visitorId, eventClass, action, details, now }) {
  const event = {
    schema_version: SCHEMA_VERSION,
    session_id: sessionId,
    visitor_id: visitorId,
    tenant_id: tenantId,
    consent: 'yes',
    origin: SDK_ORIGIN,
    event_class: eventClass,
    action,
    role: details && typeof details === 'object' ? details.role : undefined,
    element_key: details && typeof details === 'object' ? details.element_key : undefined,
    timestamp_ms: now()
  };

  if (details && typeof details === 'object') {
    for (const key of OPTIONAL_METADATA_KEYS) {
      if (details[key] !== undefined) {
        event[key] = details[key];
      }
    }
  }

  for (const key of Object.keys(event)) {
    if (event[key] === undefined) {
      delete event[key];
    }
  }

  return event;
}
