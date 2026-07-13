# Behaviour model and dashboard completion audit

Audit date: 13 July 2026. Audited baseline: `origin/main` at merge commit `f4caab33c9d9a45f9f5de49752c05e50a251fd60`.

## Audit decision

The source-grounded gap-identification objective is evidenced: every one of the 25 roadmap requirements is implemented, explicitly rejected/reframed, or retained as an owned gap with an acceptance and release boundary. The product itself is not production-complete. Behavioural-depth, action-layer, assurance and governed-intelligence gaps remain open and block broader claims.

This audit distinguishes repository implementation from live production proof. Tests and merged code establish repository behaviour; they do not substitute for DPIA, full accessibility, corpus/fairness, retention/deletion, rate-limit, incident, live identity-provider or production deployment evidence.

## Requirement ledger

| Requirement | Audit state | Authoritative repository evidence | Residual gap or release boundary |
| --- | --- | --- | --- |
| MODEL-01 | Implemented with residual inventory gap | `contracts/models/flux-service-model.schema.json`; `src/model/`; migrations 0003–0004; service-model tests | GAP-013: complete ResearchOps inventory |
| MODEL-02 | Partial, retained | Model contract, summary and funnel/field reports store and show complexity | GAP-013: comparable complexity-adjusted effort/error/help baselines |
| MODEL-03 | Implemented | Publisher outcomes/key events, collector attribution, event report and tests | Generic submit must never imply success |
| MODEL-04 | Implemented | `src/product/funnel-field-reports.mjs`; funnel tests and dashboard panel | Preserve ordered/time-bounded definitions |
| MODEL-05 | Implemented | Field report module, aggregate distributions, dashboard and tests | Values remain prohibited; publisher inventory incomplete |
| MODEL-06 | Implemented for configured transactions | Time-ordered friction/recovery/configured-success funnel SQL and tests | Richer recovery capture remains optional governed depth |
| MODEL-07 | Partial, retained | Required/optional field model and aggregate field evidence | GAP-015: disclosure purpose and complete consent-choice denominator |
| MODEL-08 | Retained | No idle/visibility/resume event contract or hosted capture lifecycle found | GAP-015: bounded, conservative interrupted-journey lifecycle |
| MODEL-09 | Partial, retained | Pointer/touch metadata and k=5 interaction-mode comparison | GAP-015: necessary coarse compatibility/accessibility context only |
| MODEL-10 | Retained | `assist.help` opening exists; no configured help level/type or dismissed/engaged/outcome lifecycle | GAP-015: content-free contextual-help taxonomy |
| MODEL-11 | Retained | No search request/refinement/result/outcome lifecycle found | GAP-015: terms and result content remain prohibited |
| MODEL-12 | Implemented | `src/product/lifecycle-analytics.mjs`, Cohorts report, k=5 controls and tests | Descriptive only; retention and alternative explanations remain visible |
| MODEL-13 | Retained | Backspace/Delete count exists; meaningful editable-state, selection and held-key guards are incomplete | GAP-015: correction-context contract without selected text |
| DASH-01 | Implemented | Server acceptance migration, realtime module/API/panel and tests | No live identity map; delivery observability remains GAP-007 |
| DASH-02 | Implemented | Event/key-event trend, rankings, reach, comparison, dashboard and tests | Complete publisher inventory remains necessary |
| DASH-03 | Implemented | Exact-version semantic entity reports and dashboard tables | Unmodelled publisher areas remain absent |
| DASH-04 | Implemented | Range contract, controlled comparisons, k=5 suppression and tests | Retention policy remains a production gate |
| DASH-05 | Implemented with statistical limits | Funnel percentiles, field distributions, samples, Wilson intervals and governance caveats | Intervals do not correct dependence, selection or collection gaps |
| DASH-06 | Implemented | Aggregate export allow-list, provenance, formula protection, route and tests | Raw event export remains unavailable |
| DASH-07 | Retained | No governed acquisition/source/campaign contract found | Only allow-listed, identifier-free categories after necessity review |
| DASH-08 | Partial, retained | Visit/outcome/task/input-mode comparisons and journey cohorts | Governed non-sensitive service-property contract remains absent |
| DASH-09 | Retained | No release/intervention/hypothesis/owner/follow-up model found | GAP-016: accountable analytics-to-action layer |
| DASH-10 | Implemented | Nine URL-backed report areas, shared filters, focus, hidden-state and responsive tests | Full screen-reader evidence remains GAP-003/GAP-006 |
| NLP-01 | Retained and blocked | No aggregate NL intent/query/audit service; prerequisite controls recorded | GAP-017: RBAC, redaction, k≥5, citations, audit and refusal evaluation |
| ADAPT-01 | Reframed and blocked | Product charter and harm register prohibit covert/consequential person-level adaptation | GAP-017: only user-controlled assistance after consent, accessibility, DPIA and experiment gates |

## Source and screenshot coverage

The source register in `behaviour-model-dashboard-gap-analysis.md` maps all supplied artefact families to requirements. The three Google Analytics screenshots are represented by realtime activity (DASH-01), event/key-event and page/entity reporting (DASH-02/03), range and comparison controls (DASH-04), acquisition/source context (DASH-07), and audience/property panels (DASH-08). The first four are implemented; source and general property context remain deliberately retained gaps rather than being silently omitted.

The historical high-risk expectations are also accounted for. Education, literacy, intelligence, personality, social-profile, visited-link, password-content and free-text sentiment inference are rejected. Precise realtime user maps and opaque personal adaptation are reframed to aggregate service health and user-controlled assistance. These decisions are governance outcomes, not missing implementation.

## Evidence strength

- Strong repository evidence: contracts, migrations, runtime modules, generated assets, focused tests, full CI, CodeQL and merged PR review for MODEL-01/03–06/12 and DASH-01–06/10.
- Partial repository evidence: MODEL-02/07/09 and DASH-08 have useful foundations but do not meet the full acceptance boundary.
- Explicitly missing: MODEL-08/10/11/13, DASH-07/09 and NLP-01.
- Reframed and gated: ADAPT-01.
- Missing live/release evidence: production retention/deletion, rate limiting, incident controls, DPIA, full accessibility, corpus/fairness evaluation, delivery acceptance/drop rates and provider sign-in evidence remain in the gap register. GitHub API verification also proves that main currently has neither branch protection nor a repository ruleset (GAP-001).

## Completion boundary

This audit completes identification and classification of the requested model/dashboard gaps. It does not close GAP-002–010 or GAP-012–017, and it does not claim general availability. Any future implementation must update this ledger, the source matrix, conformance evidence, gap register and harm register together so the roadmap cannot drift back into stale claims.
