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

A service-only model with no transactions, outcomes or key events is valid while a new owner configures the tenant. Generic submits still never become completion evidence merely because no success event has been configured.

Labels and keys are bounded and content-safe. The runtime validator enforces the same collection limits as the JSON contract: 5,000 entities, 10,000 bindings, 1,000 outcomes and 2,000 key events. It rejects malformed collection items, URLs, email-like labels, multiline text, unknown properties, unresolved hierarchy references, duplicate bindings, ambiguous key-event matches and key events whose configured outcome belongs to another transaction. It contains service configuration only—never visitor identifiers, entered values or page content.

## Publication and immutability

Tenant owners publish a model with `PUT /api/service-model/:tenant`. Authenticated tenant members can read the published version with `GET /api/service-model/:tenant`.

Publication validates the complete model, calculates a canonical SHA-256 manifest hash, retires the previous published version and atomically stores the new immutable version. Existing version numbers cannot be overwritten. An invalid model at rest is not used by the dashboard or collector.

New publication also applies binding safety policy: tenant-global `autocomplete.*` categories cannot be attached to any service entity; a field binding must begin with `field.`, fit the shared 160-character semantic-key contract and cannot claim a reserved or nested authentication scope; and underscore is treated as an authentication namespace separator alongside dot, colon and hyphen. The neutral `auth.otp` lifecycle binding remains valid outside fields. This policy blocks dashboard and direct API publication equally. Structural validation remains able to read a previously published legacy version so a stricter release does not make the tenant dashboard unavailable before an owner can replace that model. During that transition, publication may retain an exact element/entity binding already present in the authorised current version, but it cannot add, move or rename a prohibited binding; the governed ResearchOps seed contains no such binding.

## Owner configuration workflow

The **Tasks and funnels** and **Fields** dashboard areas provide the authenticated authoring workflow. Tenant owners can:

- create, rename, reorder and delete funnels;
- create, rename, reorder and delete tasks within a funnel;
- create, rename, reorder and delete steps, each bound to an exact publisher `data-flux-key` of at most 160 characters;
- create, edit and delete success events from an exact Flux action and `data-flux-key` pair of at most 160 characters;
- create, rename and delete question or field groups under an ordered step and declare their service complexity from 1 to 7;
- create, edit and delete required or optional fields with an exact publisher `data-flux-key` binding of at most 160 characters. Global content-free `autocomplete.*` categories and reserved or nested authentication scopes cannot be claimed as field-specific bindings.

Labels can change without changing stable entity, outcome or key-event keys. Generated entity and event keys are truncated before collision suffixes are added so every semantic identifier and binding remains inside the common 160-character contract. Renaming a field or step binding updates its matching key events without changing the entity's identity. A new, existing or previously unbound field or step can claim a same-transaction binding that was created earlier for its success event, preserving the documented authoring order and stable identity. Transaction bindings are retained when success events change because the model does not claim that those semantic mappings were created only for the event. Outcomes with several action-and-element matches display and manage every matching event individually; deleting one match retains the outcome until its final match is removed. Deleting a funnel removes its dependent tasks, steps, bindings and outcomes from the next model version; deleting a task or step removes only its dependent hierarchy and event bindings plus any outcome that loses its final matching event; deleting a question group removes its fields, bindings, key events and any success outcome that would otherwise become unreachable. The confirmation names those dependent outcomes before publication. Viewers see the published structure but cannot edit it, an open Fields or Tasks editor is not discarded by analytics refreshes or by its sibling manager publishing, and the publication API repeats the owner check rather than relying on hidden controls. A version conflict is rejected instead of overwriting another owner's publication.

Every saved action publishes the complete next model version. Newly accepted events use that version; historical event context remains attached to the version that was active at collection time. The editor is tenant-generic: ResearchOps supplies the current tenant model and semantic attributes, while Flux owns authoring, validation, versioning and interpretation.

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

The dashboard reports the published version, configured entity/binding/outcome/key-event counts, semantic mapping coverage and transaction complexity. Mapping and key-event evidence is filtered to that exact published model key and version, so historical rows from retired versions cannot be attributed to the current model. Retired-version interactions are counted separately and excluded from the current-version mapping denominator rather than being mislabelled as unmapped. Its accessible key-event table reports selected-period event and session counts using publisher labels and configured outcome types. The selected-period event lookup is supported by a tenant-and-time index, and the table scrolls within its region on narrow screens.

Publisher key events must also be possible under the event contract: action keys are capped at 80 characters, semantic identifiers and element keys at 160, and the reserved `auth.otp` element accepts only the requested, succeeded and failed OTP lifecycle actions. The initial ResearchOps model deliberately leaves global email autocomplete unbound because that content-free category can occur in more than one transaction. It also omits stakeholder-submit success until ResearchOps exposes a neutral post-success milestone that remains observable when the form contains a sensitive email field.

Exact-version entity, ordered transaction-funnel and privacy-safe field-coverage reports are implemented. Completing the ResearchOps publisher model, configurable comparisons, uncertainty, exports and the target dashboard information architecture remain tracked in GAP-013 and GAP-014.
