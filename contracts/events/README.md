# Event contract validation

This directory contains the governed event contract for Flux Behaviour.

The contract is deliberately metadata-only.

It requires explicit consent and excludes content-bearing fields such as values, text, passwords, email fields, clipboard text and file names.

## Fixture coverage

Event fixtures are held under:

- `fixtures/events/valid/`
- `fixtures/events/invalid/`

Valid fixtures show the minimum safe metadata events that future SDK and collector implementations may emit or accept.

Invalid fixtures show unsafe telemetry that must be rejected.

## Runtime status

This contract is not yet wired into a collector or SDK.

Future runtime code must use this contract before accepting, storing or emitting events.

## Release rule

No collector PR should be accepted until it uses this contract or an explicitly superseding version.
