# Collector storage readiness

Status: storage-readiness design. This is not storage implementation.

## Purpose

This document defines the storage posture required before Flux Behaviour can persist collector events.

The current collector must continue returning `stored: false` until a separate reviewed PR introduces actual storage bindings and writes.

## Current state

The repository now contains a storage contract module:

- `src/collector/storage-contract.mjs`

The module defines:

- storage status constants;
- storage decision constants;
- storage candidate shape;
- storage candidate validation;
- disabled event store behaviour.

The disabled event store validates candidates but never writes.

## Explicit exclusions

This package does not add:

- R2 binding;
- D1 binding;
- Queue binding;
- Durable Object binding;
- `wrangler.toml`;
- deployment configuration;
- production storage writes;
- production retention jobs;
- deletion jobs;
- dashboard access;
- SDK instrumentation.

## Storage decision matrix

| Option | Candidate use | Benefits | Risks | Current decision |
| --- | --- | --- | --- | --- |
| Cloudflare R2 | Append-only event objects | Simple object storage, good for batched analytics | Needs lifecycle rules, object naming and deletion strategy | Candidate only |
| Cloudflare D1 | Queryable metadata index | SQL querying and deletion tracking | Could tempt direct user/session querying | Candidate only |
| Cloudflare Queues | Buffer before persistence | Back-pressure and retry handling | Adds operational complexity and dead-letter design | Candidate only |
| Durable Objects | Per-session coordination | Can coordinate sequence state | Higher complexity and stateful risk | Not preferred now |
| No storage | Current state | Safest during contract hardening | No analytics persistence | Active state |

## Minimum storage controls before implementation

Before any write path is merged, the repository needs:

- reviewed storage type decision;
- retention period;
- object/key naming strategy;
- deletion and reindexing strategy;
- operational owner;
- incident response path;
- access-control model;
- audit logging policy;
- data minimisation review;
- DPIA alignment;
- migration and rollback plan;
- tests proving invalid events are never stored;
- tests proving no content-bearing fields can be stored.

## Retention strategy

Default posture: short retention by design.

A future storage PR must define:

- maximum raw event retention;
- aggregation retention;
- deletion trigger;
- backup and replica policy;
- who can approve retention changes.

No default retention duration is committed here because it requires product, security and data-protection review.

## Deletion and index strategy

A future storage PR must include:

- a primary object identifier that is not user content;
- a deletion index that can locate stored objects without inspecting event content;
- deletion tests;
- evidence that deletion does not require processing raw typed values;
- recovery behaviour when index and object store disagree.

## Release rule

Do not introduce storage writes until this readiness document is updated with a specific storage decision and the linked controls are implemented.
