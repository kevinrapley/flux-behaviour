import { installFluxBrowserTag, createBrowserTransport } from '/assets/flux/sdk/flux-browser.mjs';
import { instrumentFields } from '/assets/demo/flux-field-capture.js';

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
    .filter(([key]) => !['schema_version', 'session_id', 'consent', 'origin', 'event_class', 'action', 'role', 'element_key', 'timestamp_ms'].includes(key))
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

installFluxBrowserTag(window, {
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

instrumentFields(document, (eventClass, action, details) => {
  window.flux('event', eventClass, action, details);
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
