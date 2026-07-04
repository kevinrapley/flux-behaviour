# Recent Learnings

Recent learnings created by the LLM agent in reverse-chronological order (most recent first).

---

## 2026-07-04 — Rich behavioural capture can stay content-free

Typing speed, corrections, clipboard use, revisits and input method are all measurable as bounded counts and timings without recording key identity or content. Contract v1.1.0 adds these as optional metadata; the capture layer reduces keys to printable/backspace/other at the point of listening, so content never exists in the pipeline. Contract version bumps ripple through fixtures, tests and the SDK constant — the drift test between the schema module and the JSON contract catches misses.

## 2026-07-04 — Playground scores need engine fidelity and interpretation guardrails together

The playground runs the v6.10 engine reference parameters (neutral, EMA, median filter, rate limit, decay, deadband) so score movement feels like the real model, but the event-to-stimulus mappings are demo heuristics and the page says so. Score displays must carry the interpretation policy (service improvement only, never user judgement) wherever they appear, including demos.

## 2026-07-04 — The SDK must validate against the shared contract before transport

The browser tag reuses the same schema module and runtime validator as the collector, strips unknown fields before validation and drops invalid events instead of sending them. Client and server enforcing one contract means a compromised or buggy page cannot widen what leaves the browser. Consent is a hard gate, not a flag on the payload: without it events are dropped, never queued.

## 2026-07-04 — Demo honesty requires labelling fixtures and delivery uncertainty

The demo dashboard renders fixture data while collector storage is disabled, and says so on the page. The journey event log says "emitted" rather than "sent", because sendBeacon acceptance does not confirm delivery. Demo surfaces must not imply capability the system does not have.

## 2026-07-04 — GOV.UK demo build mirrors the ResearchOps pattern

The demo uses govuk-frontend v6 from npm, a Sass entry point, Nunjucks page rendering and static output to a gitignored public/ directory, following the working ResearchOps build. Charts follow ONS Charts conventions (per-breakpoint config, accessible summaries, source lines) pending direct vendoring of ONSdigital/Charts.

## 2026-05-29 — Boundary controls should precede storage bindings

Before introducing storage, the collector boundary needs explicit controls for CORS, preflight, allowed methods and headers, request body limits and rate-limit interfaces. These controls reduce exposure risk but do not replace production deployment review.

## 2026-05-29 - Worker adapter imports must avoid Node-only modules

The worker adapter imports must avoid Node-only modules. Importable schema modules and drift tests preserve the JSON contract without pulling filesystem APIs into the Worker runtime.

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
