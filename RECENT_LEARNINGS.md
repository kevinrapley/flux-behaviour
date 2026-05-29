# Recent Learnings

Recent learnings created by the LLM agent in reverse-chronological order (most recent first).

---

## 2026-05-29 — Collector routes should validate before storage exists

The collector scaffold should accept or reject events using the shared validator while storage is explicitly disabled. Persistence, Cloudflare bindings, CORS policy and rate limits should be added only after route behaviour is reviewed.

## 2026-05-29 — Runtime validation should come before collector or SDK implementation

The event validator is the shared gate future collector and SDK work must use. It should return safe structured errors and must not echo submitted values, raw payloads or content-bearing fields back to callers.

## 2026-05-29 — Fixture baselines should precede runtime validation modules

Before adding a collector or SDK, add valid and invalid event fixtures plus scoring-reference cases. Fixtures make privacy, consent and interpretation boundaries concrete and testable before runtime code exists.

## 2026-05-28 — Promote product meaning and contracts before runtime code

The next safe promotion step is governance documentation, event contracts and reference scoring lineage. Runtime collector, SDK and dashboard code should wait until consent, no-PII schema and scoring reference tests are in place.

## 2026-05-27 — Public-service analytics requires a harm register

Flux concerns public-service journeys, behavioural signals, accessibility and potentially vulnerable users. Keep `harm-register.yaml` active.

## 2026-05-27 — Cloudflare configuration must be sanitised

The prototype `wrangler.toml` pattern includes environment-specific configuration and a committed delete secret pattern. Do not copy it. Use platform secrets.

## 2026-05-27 — Prototype source is lineage, not production code

`kevinrapley/flux-behavioural-analytics` is useful source material, but runtime files must be promoted through reviewed PRs.
