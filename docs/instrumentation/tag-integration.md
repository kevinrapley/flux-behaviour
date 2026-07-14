# Tag integration

The Flux tag adds behavioural analytics to a website or service the same way other analytics tags do: a small snippet on every page, plus a hosted module.

The rendered, public implementation guide is available at [flux-behaviour.pages.dev/developers/](https://flux-behaviour.pages.dev/developers/). It covers the hosted tags, every supported `data-flux-*` attribute, dashboard configuration and HTTP APIs.

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
  data-flux-tag="flux-4b198da742124ec7a2c9e96a1ef0a632"></script>
```

Every tenant receives exactly one active, unique installation tag when a platform administrator provisions it. The value is an opaque public routing identifier, not a secret or credential. It does not replace the tenant origin allow-list. A tenant owner can retrieve the stable tag and complete snippet from `GET /api/tenant/:tenant/installation`.

The existing ResearchOps integration may continue to use `data-flux-tenant="researchops"`. That direct tenant-ID compatibility path is restricted to the literal ResearchOps tenant. New tenants must use `data-flux-tag`.

Commands queued before the module loads are replayed in order once it installs. The module is `src/sdk/flux-browser.mjs`, wired by `installFluxBrowserTag(window)`; a host page or bundler provides the install entry point.

The hosted `/assets/flux/*` module graph is returned with `Access-Control-Allow-Origin: *` so publisher origins can load it. A self-hosted CDN or reverse proxy must return an equivalent CORS header for the entry module and every relative import.

## Consent

Consent is never assumed. The manual browser tag does not persist the consent decision; the automatic-capture module stores the choice made in its built-in banner under `flux.behaviour.consent`. Until the service calls:

```js
flux('consent', 'granted');
```

every event command is dropped without being stored, queued or sent. `flux('consent', 'revoked')` stops emission immediately. When an external preference control revokes consent while the automatic-capture module is loaded, it must first set `flux.behaviour.consent` to `no`; otherwise the module can restore its previous `yes` choice on the next page.

```js
localStorage.setItem('flux.behaviour.consent', 'no');
flux('consent', 'revoked');
```

## Sending events

```js
flux('event', 'nav', 'page.loaded', { role: 'page', element_key: 'page.application.start' });
flux('event', 'input', 'field.blur', {
  role: 'field',
  element_key: 'field.application.full-name',
  duration_ms: 1200,
  edit_count: 3,
  value_length: 12
});
```

Contract version 1.2.0 adds richer interaction metadata and autocomplete milestones, all of it content-free:

- `key_press_count`, `backspace_count` — typing volume and corrections; key identity is never recorded, only "printable", "backspace/delete" or "other"
- `dwell_before_input_ms` — the inactive interval between focus and the first keyboard, input or paste interaction
- `typing_duration_ms`, `words_per_minute` — active typing time and standard gross words per minute, calculated from printable non-shortcut keystrokes divided by five over the first-to-latest typing interval; this excludes pre-input dwell, modifier shortcuts and words already present in an edited field
- `paste_count` — clipboard use as a count, never clipboard content
- `revisit_count` — how many times a field was refocused
- `pointer_type` — whether focus arrived by mouse, touch, pen or keyboard

The hosted auto-capture module also owns the 30-minute inactivity boundary, final-destination Tab context, Enter/Return activation, browser-autocomplete signals, purpose-led structural fallbacks and the on-device UK-English analyser. Ordinary autofill emits only the semantic field key. Excluded sensitive autofill emits only an allow-listed category (`email`, `password`, `one-time-code`, `telephone`, `payment` or `other`) with no value, length or identity. Publishers provide the hosted include and controlled `data-flux-*` attributes; they do not copy the analytics engine, dictionary or narrative logic into their service repositories.

Public attributes are `data-flux-endpoint`, `data-flux-tag`, `data-flux-key`, `data-flux-role`, `data-flux-page`, `data-flux-sensitive`, `data-flux-writing-analysis` and `data-flux-autofocus`. `data-flux-tenant` remains available only for the legacy ResearchOps installation. The auto-capture consent banner also uses its internal `data-flux-consent` control. Attribute values must remain controlled configuration and must never contain entered content or direct identifiers. For compatibility with the publisher service model, semantic keys start with a lowercase letter and contain only lowercase letters, numbers, dots, underscores and hyphens, with no trailing or repeated separators.

Sensitive-control detection and `data-flux-sensitive="true"` apply to automatic capture only. A manual `flux('event', ...)` integration must never emit events for sensitive fields or include entered values, contact details, payment details, authentication data or other direct identifiers.

Those controlled semantic keys are bound centrally in Flux's publisher service model. Services do not embed hierarchy, complexity, outcome interpretation or analytics queries in their own repositories. An interaction becomes a key event only when its exact action and semantic element match a published Flux configuration; a generic form submit is never assumed to be success.

Every event is built against the published event contract (`contracts/events/flux-event.schema.json`) and validated locally before transport:

- fields outside the optional metadata allowlist are stripped before validation, so typed values, free text and identifiers cannot leave the page
- events that still fail validation are dropped, not sent
- session identifiers are generated client-side and carry no personal data

## Transport

The default browser transport uses `fetch` with `keepalive: true` and `credentials: 'omit'`, then falls back to `navigator.sendBeacon` if fetch is unavailable or fails. Both send a single JSON event per request to match the collector contract and its boundary controls.

The SDK places the public installation tag in the event contract's `tenant_id` field. The collector resolves the active tag to the internal tenant before checking its origin and storing any visitor, session, event or model context. An unknown, revoked or cross-tenant tag is rejected.

## Failure behaviour

Transport failures are reported to the optional `onDrop` callback and never throw into the host page. Events are not retried; losing metadata is preferred over buffering behavioural data client-side.
