# ADR: Governed Reset

## Decision

Create `kevinrapley/flux-behaviour` as a governed reset rather than cloning `kevinrapley/flux-behavioural-analytics`.

## Context

The prototype contains useful concepts and artefacts, but it is an alpha prototype and includes environment-specific configuration that must not be inherited directly.

## Consequences

Runtime code must be reviewed before promotion. Cloudflare configuration must be rewritten with secret bindings. Assurance files become first-class repository artefacts.
