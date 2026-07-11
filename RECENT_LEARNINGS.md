# Recent Learnings

Recent learnings created by the LLM agent in reverse-chronological order (most recent first).

---

## 2026-07-11 — Sparse production data reveals dashboard copy and chart defects

Fixture-rich previews can hide singular grammar and repeated axis ticks. Verify the authenticated dashboard with real sparse data: pluralise calculated rates and reduce grid steps when the chart maximum is below the normal tick count.

## 2026-07-11 — Analytics dashboards should lead with cumulative service evidence

A chronological dump of sessions is an investigation tool, not a useful dashboard. Lead with period-based visitors, returning visitors, sessions, interactions, comparison deltas and trends; keep individual journeys as an intentional drill-down. This improves decision usefulness and also reduces the prominence of pseudonymous identifiers.

## 2026-07-11 — Runtime assets need a source-of-truth build path

Static `public/` assets can make a feature appear to work until a normal build regenerates older source files over them. Keep deployed browser modules and dashboard modules under `src/`, copy them through the build pipeline, and regression-test the copied output. This is especially important for consent and identity behaviour: a successful one-off Pages upload is not evidence that the next governed deployment preserves it.

## 2026-07-11 — Structural capture must still exclude authentication fields

Neutral element keys and count-only metadata do not make authentication telemetry appropriate. Exclude email, telephone, password and one-time-code fields from click, focus, dwell, character-count and correction capture; remove per-focus listeners when the focus session ends. Dashboard queries should take the newest bounded event window before ordering it chronologically, so an older long session cannot erase a newer journey.

## 2026-07-11 — Neutral is the only safe score for unsupported session signals

The 20-dimension demo model cannot justify inventing an indicator from generic page activity. Production session scoring must use only consented content-free signals that have an explicit mapping; where a service does not generate a safe signal, leave that dimension at neutral and explain that the score is a service-friction heuristic, never a judgement of a person.

## 2026-07-05 — Fetch with credentials omit and keepalive ensures compliant transit; secure randomness for session IDs

We prefer `fetch` over `sendBeacon` because browser implementations of `sendBeacon` always append credentials (cookies, client certs) on same-site or credentialed endpoints, violating our strict credentials-omitted transport contract. Utilizing `fetch` with `credentials: 'omit'` and `keepalive: true` ensures safe, credentials-free delivery of behavioural analytics even during page unloads, falling back to `sendBeacon` only when `fetch` is unavailable. To resolve CodeQL's insecure randomness alert, we now prioritize the cryptographically secure `crypto.getRandomValues` (CSPRNG) API for generating session IDs, falling back to `Math.random` only when platform crypto APIs are unavailable. Additionally, we now dynamically generate CycloneDX SBOM components from `package-lock.json` dependencies to keep inventory controls complete as dependencies are added.

## 2026-07-05 — Behavioural credit requires substance; speed without consideration is not trust

The full mapping sweep found a family of contradictions with one shape: activity being rewarded as competence. Aimless tab-hunting built ICT Level and soothed frustration; three empty forward tabs scored as a wayfinding streak; Cmd+Z counted as tool fluency; box-ticking in under a second earned full trust; anxious password toggling raised epistemic confidence; failed lookup retries read as engagement; button-mashing pumped ethics. The unifying fixes: credit requires substance (creditable input, a real selection, a considered pause), corrections and retries are struggle signals, and repeats do not compound meaning. Enforced by a standing invariant test that no signal pushes one dimension in both directions, plus per-contradiction regressions, and documented in docs/product/behaviour-signal-map.md.

## 2026-07-05 — Signals need coherence guards, not just correct formulas

Rage clicking scored as high Efficiency because short pointer trails measured as perfectly efficient paths, and rapid re-clicks re-counted the previous approach from the hover window. The fixes are model-level, not weight tweaks: a stationary click is not an aiming task (efficiency 0, no credit), and an acquisition consumes its approach (one approach, one score). When two signals can be produced by the same behaviour, check they cannot pull a dimension in contradictory directions.

## 2026-07-05 — The original engine is event-driven; sampling engines silence single events

The v46.s engine applies each stimulus as its own tick (EMA → median → deadband → rate limit against time since that channel last moved), with decay on a separate clock. A fixed-interval sampling engine median-filters single events (like a help open) to zero. Porting the original semantics — including seeding channel clocks and backdating seeds before replay bursts — is what makes every behaviour visibly move its dimensions.

## 2026-07-05 — Rebuild claims need a source-repository audit, not memory

Scouring the original repository surfaced substantially more than the governed reference extract recorded: 20 dimensions (not 16), the never-called backOrSkip helper, the dual-channel frustration model, creditable-input guards, pointer miss policy with acquisition windows, personas, cohort rules, composites and engine tuning. It also surfaced honest negatives — the original's "spelling/grammar" readout was never implemented. Port from source, and record what was found unbuilt.

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
## 2026-07-11 — External identity is a separate concern from behavioural visitor identity

Google account identity may authorise a dashboard session but must never become an analytics visitor or session identifier. Bind it to a pre-provisioned account after the provider verifies the email, and keep it in a separate identity table.

---
## 2026-07-11 — Cross-service behavioural analytics needs an origin-bound tenant contract

Use a tenant ID, an allow-listed browser origin, a pseudonymous persistent visitor ID and a browser-session ID together. Do not derive analytics identity from an authenticated account email or typed page content.

---

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
