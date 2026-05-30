# Collector boundary controls

Status: boundary-control scaffold. This is not a deployment configuration and does not enable storage.

## Purpose

The collector boundary controls harden the `/collect` route before storage, SDKs or production deployment configuration are introduced.

The controls sit in front of the existing collector router and only apply to `/collect`.

## Controls added

The boundary module provides:

- CORS origin checks for `/collect`;
- `OPTIONS /collect` preflight handling;
- request method restriction to `POST` and `OPTIONS`;
- request header allow-list checks during preflight;
- JSON content-type enforcement for `POST /collect`;
- content-length based body-size guard;
- rate-limit interface stub;
- no-storage behaviour preservation.

## Configuration shape

The Worker adapter can derive its boundary policy from environment values:

- `FLUX_ALLOWED_ORIGINS`
- `FLUX_ALLOWED_HEADERS`
- `FLUX_ALLOWED_METHODS`
- `FLUX_MAX_BODY_BYTES`

No real environment values are committed.

## Explicit exclusions

This package does not add:

- `wrangler.toml`;
- Cloudflare account IDs;
- custom domains;
- routes;
- R2, D1, Queues or Durable Objects;
- storage writes;
- production rate limiting;
- deployment workflows;
- SDK or browser instrumentation;
- scoring logic;
- dashboard/UI code.

## Remaining work

Before live collection, the product still needs:

- reviewed origin list;
- production rate-limit mechanism;
- body-size policy review;
- retention and deletion policy;
- incident handling process;
- deployment configuration review;
- DPIA and security sign-off.
