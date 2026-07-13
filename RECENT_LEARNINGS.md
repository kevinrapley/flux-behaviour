# Recent Learnings

## 2026-07-13 — Global categories and retired model context need explicit boundaries

A content-free autocomplete category such as `autocomplete.email` is global, not proof that the visitor is in a sign-in field, so it must not be bound to a transaction-specific model entity without contextual capture. Publisher key events also need event-contract validation: syntactically valid but uncollectable action/element pairs create silent outcome gaps. When a model version changes, exclude retired-version context from current mapping coverage and report it separately from genuinely unmapped events.

## 2026-07-13 — Realtime freshness needs server acceptance time

Browser occurrence time answers when an interaction claims to have happened; it cannot prove when Flux received it and may be skewed. Store an indexed server acceptance timestamp, use that for realtime windows and freshness, and keep the realtime response aggregate-only so operational visibility does not become a live user surveillance view.

## 2026-07-13 — Completion is a configured outcome, not a submit event

A submit records an interaction, not whether the service achieved its purpose. Bind an exact action and semantic element to a publisher-declared transaction outcome, freeze that model version beside the event, and calculate completion only from configured success outcomes. This prevents failed, progress-only and unrelated submissions from becoming false success evidence.

## 2026-07-13 — Public source registers must not contain private Drive access material

Use descriptive source labels in public roadmap and evidence files. Keep Google document IDs, file IDs, resource keys and other link-access material in the product owner's private provenance record unless publication is explicitly approved.

## 2026-07-13 — A rich event stream is not yet a behavioural analytics model

The source documentation is organised around publisher-defined transactions, tasks, questions, complexity and outcomes. A recorder that stores semantic interaction events can narrate journeys, but it cannot produce trustworthy funnels, field coverage, disclosure, complexity-adjusted effort or action recommendations until those service concepts have first-class versioned definitions. Dashboard breadth depends on that model; charts cannot substitute for it.

## 2026-07-12 — Typing speed must exclude prefilled content

The writing analyser's final word count describes the whole field, so dividing it by the current edit interval inflates WPM whenever a visitor edits existing text. Calculate standard gross WPM from printable, non-modifier keystrokes divided by five over active typing time; keep whole-field word counts only for the separately labelled on-device writing analysis, and keep Ctrl/Cmd/Alt shortcuts out of typing volume.

## 2026-07-12 — Negative tabindex is focus infrastructure, not a control

Containers such as `main tabindex="-1"` support skip-link focus management but are not user-operable controls. Exclude negative-tabindex elements from automatic interaction targeting so background clicks do not become unlabelled control events.

Recent learnings created by the LLM agent in reverse-chronological order (most recent first).

---

## 2026-07-12 — The analytics product must own its capture engine

A publisher repository should provide only the hosted Flux include, tenant configuration and controlled `data-flux-*` context. Session boundaries, input-method interpretation, autocomplete detection, UK-English analysis, dictionaries, privacy validation and narrative logic belong in Flux Behaviour. Copying them into each publisher creates drift, hides contract changes and makes a service repository responsible for product analytics behaviour it cannot govern consistently.

## 2026-07-12 — Linguistic metadata still needs an explicit locale, consent and fairness boundary

Possible spelling, grammar and casing counts can enrich a journey without transmitting words, but they remain content-derived signals. Publishers must analyse locally after consent, declare the `en-GB` baseline, send an atomic bounded count bundle and discard text before transport. Flux must use “possible issue” wording and prohibit literacy, intelligence, professionalism, personality, protected-characteristic and automated-decision interpretations; representative corpus, accessibility and fairness validation remains a release blocker.

## 2026-07-12 — Focus duration, pre-input dwell and active typing time are different signals

A field's focus-to-blur duration cannot be described or scored as dwell after typing begins. Capture the pause before the first keyboard, input or paste interaction separately, calculate typing rate only across the first-to-latest typing interval, and describe legacy typed events as total focus time when genuine dwell is unavailable.

## 2026-07-12 — Generated identifiers are diagnostic data, not journey language

An `auto.*` key can preserve event structure, but its DOM tag and ordinal cannot establish service purpose. Journey presentation should translate controlled semantic keys, replace generated fallbacks with an explicitly unlabelled control type, and rebuild prose from stored event metadata at read time so narrative improvements also apply to historical rows without rewriting evidence.

## 2026-07-12 — Semantic telemetry needs controlled service meaning

A useful journey narrative needs controlled service meaning, not DOM position, URL segments or copied interface text. Type-first `data-flux-*` keys can name a page, tab, button, field or form without reading content, and page meaning must require the literal `page.` namespace so legacy hyphenated keys remain generic. An allow-listed lifecycle event can report that OTP verification succeeded without observing the code, its length, the email or account identity, but it must match the neutral trust/service/auth shape and carry no optional metadata. Narrative generation must distinguish untouched prefilled fields, keyboard entry, paste and autofill using edit evidence; an existing value length alone is neither visitor input nor safe journey evidence. These rules belong at manual SDK and collector boundaries too: auth scopes require case-insensitive normalisation, the reserved `auth.otp` key cannot be reused, sensitive form state must propagate to descendants, and an auth-scoped descendant must make its form sensitive.

## 2026-07-11 — Neutral evidence is not a behavioural cohort

The original careful-checking thresholds include the neutral score of 50, so a session with no supported behavioural evidence—or only routine completion evidence—would otherwise be labelled as careful checking. Production cohorting needs an explicit deliberate-check signal, journey-not-person language, tenant-scoped complete-history checks and small-group suppression. Bounded event windows must retain the newest evidence before restoring chronological order. Separate deterministic visit and outcome cohorts from heuristic interaction-pattern cohorts, and disclose bounded coverage.

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

Typing speed, corrections, clipboard use, revisits and input method are all measurable as bounded counts and timings without recording key identity or content. Contract v1.2.0 adds these as optional metadata and autocomplete milestones; the capture layer reduces keys to printable/backspace/other at the point of listening, so content never exists in the pipeline. Contract version bumps ripple through fixtures, tests and the SDK constant — the drift test between the schema module and the JSON contract catches misses.

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
## 2026-07-13 — Published-model evidence must be version-scoped

Event-time context deliberately preserves historical model versions. Dashboard queries must therefore filter context rows to the exact published model key and version before labelling evidence with the current model; tenant and period filters alone can mix retired meanings into current reports. Runtime model validation must also enforce the JSON contract's collection bounds and normalise malformed input before walking it, so invalid publisher payloads fail safely instead of creating unbounded work or server errors.
