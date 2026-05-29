# Cloudflare Worker adapter

Status: adapter only. This is not a deployment configuration.

## Purpose

The Cloudflare Worker adapter exposes the existing collector route handler through a Worker-compatible `fetch()` entry point.

It delegates request handling to `src/collector/router.mjs`.

## Entry point

`src/cloudflare/worker.mjs`

## Boundaries

This adapter does not add:

- `wrangler.toml`;
- Cloudflare account IDs;
- routes;
- custom domains;
- R2 bindings;
- D1 bindings;
- Queues;
- Durable Objects;
- environment variables;
- deployment workflow changes;
- storage writes.

Storage remains disabled.

## Worker compatibility

The collector path must not depend on Node-only runtime modules.

The route handler therefore uses the importable schema module at `src/events/flux-event-schema.mjs` and the Worker-safe runtime validator at `src/events/validate-event-runtime.mjs`.

The JSON schema file remains the authoritative contract. `tests/flux-event-schema-module.test.mjs` checks that the importable schema module matches the JSON contract.

## Next implementation step

The next safe step is CORS and rate-limit design before any storage binding is introduced.

Storage should be introduced only after adapter behaviour, request limits, CORS policy, retention, and deletion/index strategy are reviewed.
