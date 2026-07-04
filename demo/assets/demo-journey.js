import { installFluxBrowserTag, createBrowserTransport } from '/assets/flux/sdk/flux-browser.mjs';

const endpoint = document.currentScript?.dataset?.fluxEndpoint
  ?? document.querySelector('script[data-flux-endpoint]')?.dataset?.fluxEndpoint
  ?? 'http://127.0.0.1:8787/collect';

const logBody = document.getElementById('flux-event-log-body');
const logStatus = document.getElementById('flux-event-log-status');
const banner = document.getElementById('flux-consent-banner');

const networkTransport = createBrowserTransport(window);

// The demo transport sends to the collector like production would, then
// mirrors the exact payload into the on-page log so people can see what
// left the page. Collector delivery failing (for example, no local worker
// running) still counts as emitted for the demo log.
async function demoTransport({ endpoint: target, body }) {
  const event = JSON.parse(body);
  let status = 'emitted';

  try {
    await networkTransport({ endpoint: target, body });
  } catch {
    status = 'emitted (collector unreachable)';
  }

  appendLogRow(event, status);
}

function appendLogRow(event, status) {
  if (!logBody) return;

  const metadata = Object.entries(event)
    .filter(([key]) => !['schema_version', 'session_id', 'consent', 'origin', 'event_class', 'action', 'role', 'element_key'].includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  const row = document.createElement('tr');
  row.className = 'govuk-table__row';

  for (const text of [event.event_class, event.action, event.element_key, metadata, status]) {
    const cell = document.createElement('td');
    cell.className = 'govuk-table__cell';
    cell.textContent = text;
    row.appendChild(cell);
  }

  logBody.prepend(row);
}

const tag = installFluxBrowserTag(window, {
  endpoint,
  transport: demoTransport,
  onDrop(drop) {
    if (!logStatus) return;
    if (drop.reason === 'no_consent') {
      logStatus.textContent = `Dropped ${drop.event_class} event (${drop.action}): no consent has been granted.`;
    }
  }
});

document.getElementById('flux-consent-accept')?.addEventListener('click', () => {
  window.flux('consent', 'granted');
  banner?.setAttribute('hidden', '');
  if (logStatus) logStatus.textContent = 'Consent granted. Metadata-only events appear below as you use the form.';
  window.flux('event', 'trust', 'consent.granted', { role: 'service', element_key: 'consent-banner' });
  window.flux('event', 'nav', 'page.loaded', { role: 'page', element_key: 'journey' });
});

document.getElementById('flux-consent-reject')?.addEventListener('click', () => {
  window.flux('consent', 'revoked');
  banner?.setAttribute('hidden', '');
  if (logStatus) logStatus.textContent = 'Consent rejected. No events will be emitted.';
});

const focusStartTimes = new Map();
const editCounts = new Map();

document.addEventListener('focusin', (event) => {
  const fieldKey = event.target?.dataset?.fluxField;
  if (!fieldKey) return;

  focusStartTimes.set(fieldKey, performance.now());
  window.flux('event', 'focus', 'field.focus', { role: 'field', element_key: fieldKey });
});

document.addEventListener('focusout', (event) => {
  const target = event.target;
  const fieldKey = target?.dataset?.fluxField;
  if (!fieldKey) return;

  const startedAt = focusStartTimes.get(fieldKey);
  const durationMs = startedAt === undefined ? 0 : Math.round(performance.now() - startedAt);
  focusStartTimes.delete(fieldKey);

  const details = {
    role: 'field',
    element_key: fieldKey,
    duration_ms: Math.min(durationMs, 3600000),
    edit_count: Math.min(editCounts.get(fieldKey) ?? 0, 10000)
  };

  if (typeof target.value === 'string') {
    details.value_length = Math.min(target.value.length, 10000);
  }

  window.flux('event', 'input', 'field.blur', details);
});

document.addEventListener('input', (event) => {
  const fieldKey = event.target?.dataset?.fluxField;
  if (!fieldKey) return;
  editCounts.set(fieldKey, (editCounts.get(fieldKey) ?? 0) + 1);
});

document.getElementById('journey-help')?.addEventListener('toggle', (event) => {
  if (!event.target.open) return;
  window.flux('event', 'assist', 'help.opened', {
    role: 'control',
    element_key: event.target.dataset.fluxHelp,
    reason: 'help_requested'
  });
});

document.getElementById('demo-journey-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  window.flux('event', 'nav', 'form.submitted', {
    role: 'form',
    element_key: 'demo-journey-form',
    navigation_direction: 'forward'
  });
});

export { tag };
