# Tag integration

The Flux tag adds behavioural analytics to a website or service the same way other analytics tags do: a small snippet on every page, plus a hosted module.

## Install

```html
<script>
  window.flux = window.flux || function () {
    (window.flux.q = window.flux.q || []).push(arguments);
  };
</script>
<script type="module"
  src="https://your-flux-host/assets/flux/sdk/flux-browser.install.mjs"
  data-flux-endpoint="https://your-collector.example/collect"></script>
```

Commands queued before the module loads are replayed in order once it installs. The module is `src/sdk/flux-browser.mjs`, wired by `installFluxBrowserTag(window)`; a host page or bundler provides the install entry point.

## Consent

Consent is never assumed and is never persisted by the tag. Until the service calls:

```js
flux('consent', 'granted');
```

every event command is dropped without being stored, queued or sent. `flux('consent', 'revoked')` stops emission immediately.

## Sending events

```js
flux('event', 'nav', 'page.loaded', { role: 'page', element_key: 'start' });
flux('event', 'input', 'field.blur', {
  role: 'field',
  element_key: 'full-name',
  duration_ms: 1200,
  edit_count: 3,
  value_length: 12
});
```

Every event is built against the published event contract (`contracts/events/flux-event.schema.json`) and validated locally before transport:

- fields outside the optional metadata allowlist are stripped before validation, so typed values, free text and identifiers cannot leave the page
- events that still fail validation are dropped, not sent
- session identifiers are generated client-side and carry no personal data

## Transport

The default browser transport prefers `navigator.sendBeacon` (survives page unloads) and falls back to `fetch` with `keepalive: true` and `credentials: 'omit'`. Both send a single JSON event per request to match the collector contract and its boundary controls.

## Failure behaviour

Transport failures are reported to the optional `onDrop` callback and never throw into the host page. Events are not retried; losing metadata is preferred over buffering behavioural data client-side.
