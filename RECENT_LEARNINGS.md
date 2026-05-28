# Recent Learnings

## 2026-05-27 — Prototype source is lineage, not production code

`kevinrapley/flux-behavioural-analytics` is useful source material, but runtime files must be promoted through reviewed PRs.

## 2026-05-27 — Cloudflare configuration must be sanitised

The prototype `wrangler.toml` pattern includes environment-specific configuration and a committed delete secret pattern. Do not copy it. Use platform secrets.

## 2026-05-27 — Public-service analytics requires a harm register

Flux concerns public-service journeys, behavioural signals, accessibility and potentially vulnerable users. Keep `harm-register.yaml` active.

## 2026-05-28 — Promote product meaning and contracts before runtime code

The next safe promotion step is governance documentation, event contracts and reference scoring lineage. Runtime collector, SDK and dashboard code should wait until consent, no-PII schema and scoring reference tests are in place.
