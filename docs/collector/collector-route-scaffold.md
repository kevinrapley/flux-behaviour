# Collector route scaffold

Status: route scaffold only. This is not a deployed collector.

## Purpose

This scaffold defines the first server-side collection boundary for Flux Behaviour.

It provides route handling for health checks and event validation before adding storage, Cloudflare bindings, SDK integration or deployment configuration.

## Routes

### `GET /health`

Returns scaffold service status.

The response confirms that storage is disabled.

### `POST /collect`

Accepts a JSON event payload, validates it with the shared event validation module, and returns a structured response.

A valid event receives `202 Accepted` with `stored: false`.

Invalid events receive `400 Bad Request` with safe structured validation errors.

## Explicit exclusions

This scaffold does not add:

- R2 writes;
- D1 writes;
- Queues;
- Durable Objects;
- Cloudflare Worker configuration;
- deployment configuration;
- SDK or browser instrumentation;
- scoring logic;
- dashboard or UI code.

## Safety boundary

The scaffold must not store request bodies.

The scaffold must not log raw events.

The scaffold must not echo typed values, raw payloads or untrusted additional-property names.

## Next implementation step

The next safe step is a Cloudflare Worker adapter that delegates to this route handler while keeping storage disabled.

Storage bindings should be introduced only after route behaviour, validation errors, CORS policy, rate limits and retention expectations are reviewed.
