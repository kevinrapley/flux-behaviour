# Publisher service model

Flux resolves consented interaction events against a publisher-declared model so analytics can describe the service rather than infer meaning from a generic submit or DOM position.

## Contract

`contracts/models/flux-service-model.schema.json` defines a versioned, tenant-scoped model with:

- one service root;
- transactions, tasks, steps, questions and fields in a fixed hierarchy;
- 1–7 publisher-declared complexity on questions;
- required or optional status on fields;
- semantic element bindings;
- transaction outcomes classified as success, failure, progress or abandonment;
- action-and-element-specific key events that resolve to those outcomes.

Labels and keys are bounded and content-safe. The runtime validator enforces the same collection limits as the JSON contract: 5,000 entities, 10,000 bindings, 1,000 outcomes and 2,000 key events. It rejects malformed collection items, URLs, email-like labels, multiline text, unknown properties, unresolved hierarchy references, duplicate bindings, ambiguous key-event matches and key events whose configured outcome belongs to another transaction. It contains service configuration only—never visitor identifiers, entered values or page content.

## Publication and immutability

Tenant owners publish a model with `PUT /api/service-model/:tenant`. Authenticated tenant members can read the published version with `GET /api/service-model/:tenant`.

Publication validates the complete model, calculates a canonical SHA-256 manifest hash, retires the previous published version and atomically stores the new immutable version. Existing version numbers cannot be overwritten. An invalid model at rest is not used by the dashboard or collector.

## Event-time resolution

When an event is accepted, Flux resolves its controlled `element_key` and `action` against the currently published model. The exact model version and hierarchy are frozen in `event_service_contexts`, including any matched key event and configured outcome. Later model publication cannot rewrite historical meaning.

A generic `flow.submit` remains an interaction event but is not completion evidence. Completion rates, outcome cohorts and journey status require a configured `success` outcome.

## Initial ResearchOps model

`config/models/researchops.v1.json` is the governed initial model. Migration `0004_seed_researchops_service_model.sql` is generated deterministically from that JSON and seeds:

- 38 service entities;
- 43 semantic bindings;
- 8 configured outcomes;
- 15 action-specific key events.

The first version covers account access, project navigation, project information changes and Sourcebook journeys. This is a reviewed baseline, not a claim that every ResearchOps transaction or field is yet modelled.

## Dashboard evidence

The dashboard reports the published version, configured entity/binding/outcome/key-event counts, semantic mapping coverage and transaction complexity. Mapping and key-event evidence is filtered to that exact published model key and version, so historical rows from retired versions cannot be attributed to the current model. Its accessible key-event table reports selected-period event and session counts using publisher labels and configured outcome types. The selected-period event lookup is supported by a tenant-and-time index, and the table scrolls within its region on narrow screens.

Funnels, field coverage and broader entity reports remain tracked in GAP-013 and GAP-014.
