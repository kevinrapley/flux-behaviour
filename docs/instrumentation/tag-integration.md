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
  src="https://your-flux-host/assets/flux/sdk/flux-auto-capture.mjs"
  data-flux-endpoint="https://your-collector.example/collect"
  data-flux-tenant="your-tenant"></script>
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

Contract version 1.1.0 adds richer interaction metadata, all of it content-free:

- `key_press_count`, `backspace_count` — typing volume and corrections; key identity is never recorded, only "printable", "backspace/delete" or "other"
- `dwell_before_input_ms` — the inactive interval between focus and the first keyboard, input or paste interaction
- `typing_duration_ms`, `words_per_minute` — active typing time and words per minute derived from the on-device word count and the first-to-latest typing interval, excluding pre-input dwell
- `paste_count` — clipboard use as a count, never clipboard content
- `revisit_count` — how many times a field was refocused
- `pointer_type` — whether focus arrived by mouse, touch, pen or keyboard

The hosted auto-capture module also owns the 30-minute inactivity boundary, final-destination Tab context, Enter/Return activation, browser-autocomplete signals, purpose-led structural fallbacks and the on-device UK-English analyser. Ordinary autofill emits only the semantic field key. Excluded sensitive autofill emits only an allow-listed category (`email`, `password`, `one-time-code`, `telephone`, `payment` or `other`) with no value, length or identity. Publishers provide the hosted include and controlled `data-flux-*` attributes; they do not copy the analytics engine, dictionary or narrative logic into their service repositories.

Every event is built against the published event contract (`contracts/events/flux-event.schema.json`) and validated locally before transport:

- fields outside the optional metadata allowlist are stripped before validation, so typed values, free text and identifiers cannot leave the page
- events that still fail validation are dropped, not sent
- session identifiers are generated client-side and carry no personal data

## Transport

The default browser transport prefers `navigator.sendBeacon` (survives page unloads) and falls back to `fetch` with `keepalive: true` and `credentials: 'omit'`. Both send a single JSON event per request to match the collector contract and its boundary controls.

## Failure behaviour

Transport failures are reported to the optional `onDrop` callback and never throw into the host page. Events are not retried; losing metadata is preferred over buffering behavioural data client-side.
