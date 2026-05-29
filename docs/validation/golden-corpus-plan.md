# Golden corpus validation plan

Status: baseline plan. No runtime scoring engine or collector is promoted by this document.

## Purpose

The golden corpus will provide a small set of canonical, reviewed examples that future Flux Behaviour code must satisfy.

It exists to prevent drift between:

- product intent;
- event schema;
- privacy and consent boundaries;
- scoring-reference interpretation;
- future collector, SDK and scoring implementations.

## Current baseline

This repository now includes:

- valid event fixtures under `fixtures/events/valid/`;
- invalid event fixtures under `fixtures/events/invalid/`;
- reference scoring cases under `fixtures/scoring/reference-cases/`;
- tests that validate fixture shape and interpretation boundaries.

These fixtures are intentionally small.

They prove that the product can distinguish consented metadata-only events from unsafe telemetry before any runtime collection code exists.

## What belongs in the corpus

The corpus may include:

- consented metadata-only events;
- no-consent rejection examples;
- content-bearing telemetry rejection examples;
- accessibility-adjacent interaction examples;
- trust and help-seeking examples;
- careful-checking and high-friction scoring-reference examples;
- reviewer interpretation notes.

The corpus must not include:

- real user sessions;
- typed form values;
- names, addresses, email addresses or phone numbers;
- raw clipboard contents;
- uploaded file names or file contents;
- passwords;
- direct identifiers;
- production logs.

## Promotion path

1. Keep the baseline fixtures small and manually reviewable.
2. Add a proper JSON Schema validator once runtime dependencies are introduced.
3. Add collector validation tests before accepting `/collect` requests.
4. Add SDK tests before emitting browser events.
5. Add scoring-engine tests before producing composite outputs.
6. Add dashboard interpretation tests before displaying review outputs.

## Review rule

Every new fixture must explain what risk it protects against.

Every invalid fixture must fail for the intended reason.

Every scoring-reference fixture must include `must_not_infer` boundaries to prevent unsafe interpretation.
