# Event taxonomy baseline

Status: baseline contract documentation. This is not a runtime collector implementation.

## Purpose

This document defines the first governed event taxonomy for Flux Behaviour.

It is derived from the source prototype instrumentation guide, which documented consented metadata events for focus, input, navigation, keyboard interaction, clipboard, file, picker, trust, assistive and environment signals.

## Consent rule

No event may be emitted until the user has explicitly opted in.

Events must include `consent: "yes"`.

Events with `consent: "no"` are not valid for collection in the product baseline. Revocation must stop telemetry and reset client-side state.

## Prohibited values

Events must not contain:

- typed field values;
- free-text content;
- passwords;
- names, addresses, email addresses or phone numbers;
- raw clipboard contents;
- uploaded file contents;
- direct identifiers;
- unconsented telemetry.

## Semantic element keys

Instrumented services should provide controlled, content-free semantic keys for important pages and controls. Keys use a type-first convention such as `page.account.sign-in`, `link.navigation.projects`, `button.analysis.code-retrieval`, `field.analysis.code-retrieval` and `form.auth.otp-verify`.

The key describes the control's service purpose, not its current visible text, record, user or entered value. Dynamic identifiers, query-string values, email addresses, names and free text are prohibited. A service may separately declare a schema-valid role such as `page`, `control`, `field` or `form`.

Authentication inputs remain excluded from interaction capture even when they have semantic attributes. A service may emit an allow-listed, consent-gated lifecycle milestone such as `auth.otp.requested`, `auth.otp.succeeded` or `auth.otp.failed` with the neutral key `auth.otp`. It must not include the code, email, challenge identifier, code length or account identity.

## Required event fields

| Field | Purpose |
| --- | --- |
| `schema_version` | Event schema version. |
| `session_id` | Pseudonymous session identifier. |
| `consent` | Consent state. Must be `yes` for valid collection. |
| `origin` | Source component, normally `formkit`. |
| `event_class` | High-level class such as `focus`, `nav`, `trust` or `a11y`. |
| `action` | Specific action within the class. |
| `role` | Target role such as `field`, `form` or `control`. |
| `element_key` | Stable non-identifying element key. |
| `timestamp_ms` | Unix timestamp in milliseconds. |

## Optional metadata fields

| Field | Purpose |
| --- | --- |
| `value_length` | Text length only. Never the value. |
| `edit_count` | Count of edits. |
| `duration_ms` | Dwell or burst duration. |
| `reason` | Controlled reason token for classifications such as rage click. |
| `navigation_direction` | `forward`, `back`, `skip` or `unknown`. |
| `pointer_type` | `mouse`, `pen`, `touch`, `keyboard` or `unknown`. |
| `file_count` | Number of files selected or dropped. |
| `file_size_bucket` | Size bucket only. Never file names or contents. |

## Event classes

| Class | Scope |
| --- | --- |
| `focus` | Focus entry, blur and dwell events. |
| `input` | Length, edit count and metadata-only input changes. |
| `nav` | Tab, click and step navigation. |
| `kbd` | Keyboard navigation and non-content editing patterns. |
| `clipboard` | Paste/copy metadata only. |
| `drop` | Drag-drop metadata only. |
| `file` | File chooser metadata only. |
| `picker` | Date, time and picker interaction metadata. |
| `trust` | Password reveal, confirmation, assurance and content-free authentication lifecycle interactions. |
| `assist` | Help, error summary and guidance interactions. |
| `a11y` | Skip link, keyboard-only and assistive interaction indicators. |
| `env` | Network and device context metadata. |

## Derived signals

Derived signals must be created from metadata only.

Examples include:

- rage-click candidate;
- idle episode;
- repeated error burst;
- field revisit;
- backward navigation;
- skip navigation;
- help-seeking event;
- assistive interaction marker.

Derived signals are not facts about a user. They are prompts for service investigation.

## Versioning

Breaking changes require a new schema version.

Collectors, SDKs, scoring configuration and dashboards must declare the event schema versions they support.
