# Behaviour model and dashboard gap analysis

Status: living, source-grounded product gap analysis. Implementation claims require the evidence recorded in the completion audit; this roadmap alone is not proof.

## Outcome

Flux now has the P0/P1 analytics foundation and dashboard breadth: a versioned publisher service model, configured outcomes, event-time attribution, funnels, field and entity reports, realtime health, comparisons, aggregate export, report navigation, uncertainty and MODEL-12 lifecycle evidence. The remaining product gaps are behavioural depth, complete ResearchOps modelling, complexity-adjusted interpretation, an analytics-to-action layer, governed source/property context and the prerequisites for natural-language or adaptive capability.

The service model is no longer missing, but the initial ResearchOps inventory is not complete and complexity is not yet used to create like-for-like effort baselines. See `docs/product/model-dashboard-completion-audit.md` for the current requirement-by-requirement evidence and residual gap mapping.

## Sources reviewed

The original source analysis used repository snapshot `140313c`. The current-evidence column was reconciled against `origin/main` at merge commit `f4caab33c9d9a45f9f5de49752c05e50a251fd60`; the completion audit records that later baseline requirement by requirement. The following user-provided or source-referenced artefacts informed both passes. External source locations and access material are retained privately by the product owner; this public register uses descriptive labels only.

| Source | Evidence used |
| --- | --- |
| Behaviour Model | Complexity, disclosure, environment, errors/correction, events, requests, information behaviour and time dimensions; repeatability, experience and celeration concepts. |
| Product Flow | Eight dimensional flows; publisher configuration; behavioural API, profile, model, database, reporting UI and adaptive UI relationship. |
| Dimensional Analysis | Eight measurement dimensions, 17 behavioural factors and MVP feature matrix. |
| Requirements | Transaction timing, idle state, visits, interaction modes, help, environment, errors, disclosure, information behaviour, server-side analysis and realtime feedback. |
| Things to think about | Perennial/transient behaviour, page visibility, sentiment and historical technical ideas. |
| Event parameters | Double/triple click context, empty-field correction guards, selection shortcuts and Caps Lock context. |
| NLP Admin Dashboard | Aggregate natural-language queries, explainability, governance actions, redaction, citations, accessibility, RBAC, audit and evaluation. |
| Usability and user experience are moving targets | Experience changes within sessions and across visits. |
| Conception of idea | Context-sensitive help, evolving behavioural profiles, cohorts and service intelligence. |
| Bridging the Action Chasm | Converting evidence into current-service action, experience decay and cohort progression. |
| Signals of Care | Consent, visibility, control, minimisation, retention, community participation, accessibility, anti-surveillance and anti-manipulation boundaries. |
| Potential Dashboard Stats | Complete/incomplete transactions, completion ratio and duration; field interaction coverage, required status, length, complexity and custom ranges. |
| Flux Behavioural Dashboard workbook | Dimension scores, five composites and example journey personas. |
| eCommerce Sales Funnel | Publisher-defined page identity and flexible semantic tracking for repeated controls and promotional regions. |
| Three supplied Google Analytics screenshots | Realtime 5/30-minute activity, event/key-event ranking, new/active users, source, audience/property, page/screen and comparison panels. |

## What is already implemented

- consent-gated, origin-bound, pseudonymous visitors and 30-minute sessions;
- returning-visitor and per-session histories;
- semantic page/control/field/form keys and generic fallbacks;
- click, touch, Tab, Enter, autocomplete, focus, pre-input dwell, typing, correction, paste, revisit, help, validation, rage-click, submit and selected authentication milestones;
- on-device UK English count-only writing analysis;
- D1-backed collection and authenticated ResearchOps dashboard access;
- 24-hour, 7-, 30-, 90-day, one-year, all-time and bounded custom ranges with like-for-like comparisons;
- visitors, returning visitors, sessions, interactions, daily trends, completion, duration, dwell, correction and friction summaries;
- ranked event/key-event and semantic entity reports, configured funnels, privacy-safe field coverage, aggregate CSV, 20 service-friction indicators, privacy-thresholded journey cohorts and complete per-session narratives;
- nine URL-backed report areas, overview rate intervals and an explicit data-quality/governance area.

## Gap matrix

Priority uses `P0` for enabling foundations, `P1` for the next complete analytics release, `P2` for model depth and `P3` for governed advanced capability.

| ID | Priority | Capability expected | Current evidence | Gap and acceptance boundary |
| --- | --- | --- | --- | --- |
| MODEL-01 | P0 | Publisher-declared service, transaction, task, step, question and field definitions | Implemented: tenant owners can create, edit, reorder and delete funnels, tasks and bound steps through the authenticated dashboard; every save publishes an immutable validated version, while the initial ResearchOps inventory remains incomplete | Retain owner, contract, publication, cascade and stable-key tests; complete the ResearchOps inventory without deriving labels from captured content. |
| MODEL-02 | P0 | Question and transaction complexity | Partial: 1–7 question complexity and transaction roll-up are configured and reported, but effort/error/help comparisons are not complexity adjusted | Add like-for-like complexity baselines before interpreting pauses or friction across unlike questions. |
| MODEL-03 | P1 | Key events and outcomes | Implemented: publisher-declared key events and success/failure outcomes drive completion and event reports | Retain exact action/element validation and never treat generic submit as success. |
| MODEL-04 | P1 | Transaction and step funnels | Implemented: publisher-ordered starts, sequential reach, completion, failure, 30-minute abandonment, recovery and completion-time distributions | Retain explicit path definitions, denominators and event-time ordering. |
| MODEL-05 | P1 | Field interaction coverage | Implemented: configured required/optional status, exposure, interaction, editing, validation, outcomes, corrections, dwell and safe length distributions | Never expose field values; retain neutral non-interaction and explicit empty-field validation semantics. |
| MODEL-06 | P1 | Recovery and resolution | Implemented for configured transactions: supported friction followed by `error.recovered` or a later configured success is distinguished from unresolved friction | Add richer configured recovery states only when their event contract remains content-free and time ordered. |
| MODEL-07 | P2 | Data-disclosure calibration | Partial: optional-field interaction and completion can be aggregated, but disclosure purpose and a complete consent-choice denominator are absent | Add publisher-declared disclosure purpose and aggregate consent-choice evidence only when a complete visit denominator exists. Do not infer personal traits. |
| MODEL-08 | P2 | Idle, visibility and interrupted journeys | Session inactivity creates a new session; no idle episode, visibility or resume events exist | Add bounded idle/hidden/resumed metadata and distinguish reading, interruption and abandonment conservatively. Cross-application identity or content must never be observed. |
| MODEL-09 | P2 | Environment and interaction-mode evidence | Partial: pointer, touch and privacy-suppressed interaction-mode comparison exist; governed coarse capability/browser/OS summaries do not | Add only coarse, necessary compatibility/accessibility context. Avoid fingerprinting, plugin inventories and user-ability inference. |
| MODEL-10 | P2 | Contextual help taxonomy | `assist.help` records a disclosure opening only | Configure help level/type and capture opened, engaged, dismissed and outcome-after-help states. Email/helpdesk/chat content remains out of scope. |
| MODEL-11 | P2 | Search and information-seeking journeys | No search request, refinement, result selection or success lifecycle | Add semantic, content-free search lifecycle events and connect them to configured outcomes. Search terms and result content must not be collected. |
| MODEL-12 | P2 | Repeatability, recency, experience decay and celeration | Implemented: aggregate return intervals, selected-period frequency, privacy-suppressed maturity movement and like-for-like error/help/revisit movement | Retain explicit denominators, k=5 suppression, bounded ranges and alternative explanations. Never present change as proof of individual learning or ability. |
| MODEL-13 | P2 | Input correction context | Backspace/Delete count exists regardless of whether an editable value was present; no selection/double-click context | Count correction attempts only with meaningful editable state, distinguish selection from empty-field double clicks and avoid penalising held keys. Do not record selected text. |
| DASH-01 | P1 | Realtime overview | Implemented: aggregate active sessions and interactions over 5/30 minutes, minute series, latest server acceptance and freshness state | Retain server-time freshness and prohibit live visitor identity maps. |
| DASH-02 | P1 | Event and key-event reports | Implemented: ranked events, semantic elements, configured key events, daily trends, journey reach and comparisons | Retain exact model-version meaning and accessible tables. |
| DASH-03 | P1 | Page, task, step, form and control performance | Implemented: configured entity reports cover pages/controls plus transaction, task, step, question and field reach, entry/exit, success, friction and time | Complete the publisher inventory so unmodelled ResearchOps areas become reportable. |
| DASH-04 | P1 | Flexible comparisons and ranges | Implemented: 24-hour through one-year, all-time and bounded custom ranges; previous-period, visit-maturity, outcome, task and safe interaction-mode comparisons | Retain 366-day custom limits, k=5 comparison suppression and descriptive interpretation. |
| DASH-05 | P1 | Distribution and uncertainty | Implemented: funnel median/p90, field distributions, visible samples, k=5 suppression and overview Wilson 95% intervals with collection/model caveats | Retain explicit denominators and uncertainty copy; do not present intervals as correction for collection gaps, dependence, selection effects or model error. |
| DASH-06 | P1 | Accessible export and report provenance | Implemented: authenticated allow-listed aggregate CSV includes filters, generation time, schema/model versions, samples, suppression and caveats; raw export is structurally unavailable | Retain formula-injection protection and the aggregate-only boundary. |
| DASH-07 | P2 | Acquisition/source and campaign context | No source/referrer/campaign metadata; retained in GAP-018 | Support consented, allow-listed source categories and campaign IDs only when necessary. Strip query strings and identifiers; default to direct/unknown. |
| DASH-08 | P2 | Audience/property panels | Partial: new/returning, maturity, outcome, task and heuristic journey cohorts exist; GAP-018 owns the missing governed service-defined property contract | Add only non-sensitive, publisher-defined journey properties with minimum group sizes. Do not recreate demographic profiling or expose visitor IDs. |
| DASH-09 | P2 | Change-to-outcome action layer | No release, experiment, intervention or annotation model | Let teams annotate releases/interventions, compare before/after evidence and record hypotheses, owners and follow-up decisions. This is the missing bridge from analytics to service action. |
| DASH-10 | P2 | Dashboard information architecture | Implemented: nine URL-backed report areas use shared range, comparison and aggregate-export controls | Preserve native-link fallback, focus management, filter continuity and narrow-screen containment as reports expand. |
| NLP-01 | P3 | Aggregate natural-language analytics | No intent router, aggregate query service or response policy | Implement only after report APIs exist. Require parameterised aggregate queries, RBAC, k≥5, redaction, prompt/response audit, citations, filters, freshness, caveats, deterministic explainability and refusal tests. |
| ADAPT-01 | P3 | Responsible recommendations and adaptation | No feedback API; historical sources proposed per-person UI changes from inferred literacy/domain scores | Prefer analyst-facing, reversible recommendations and user-chosen assistance. Any runtime adaptation needs an explicit purpose, consent, accessibility testing, explanation, override, experiment evidence and prohibition on consequential or covert personalisation. |

## Historical ideas that are not implementation gaps

Some source expectations conflict with the current product charter, modern browser security or humane analytics principles. They must be recorded as rejected or reframed rather than silently left on a backlog.

| Historical expectation | Decision |
| --- | --- |
| Infer education, literacy, intelligence, conscientiousness, openness, sociability or personality from behaviour or writing | Reject. These are unvalidated, high-risk person-level inferences. Retain only bounded service-friction evidence with alternative explanations. |
| Treat keyboard use, browser, operating system, device, plugins or unusual environments as ICT ability | Reject. Use coarse technical context only to find compatibility and accessibility problems. |
| Inspect visited links, social profiles, bookmarks, password strength or sensitive field content | Reject. These violate privacy, browser-security and data-minimisation boundaries. |
| Sentiment/discourse analysis over captured free text | Reject for analytics collection. Optional user-invoked text assistance must be a separate, explicit and governed feature. |
| Individual behavioural profile driving opaque realtime UI changes | Reframe. Start with aggregate service recommendations and user-controlled assistance; prohibit covert or consequential adaptation. |
| GA-style country map and user snapshot | Reframe. Realtime service health is useful; precise location and individual surveillance are not required. Coarse geography needs an explicit necessity and DPIA. |
| Marketing over-disclosure or promotional targeting | Reject for public-service Flux. Consent and optional-field completion may be analysed only to reduce unnecessary collection and friction. |

## Target dashboard information architecture

1. **Overview** — active/returning visitors, sessions, interactions, key outcomes, completion, friction, trend and freshness.
2. **Realtime** — active sessions and interactions over 5/30 minutes, latest events by safe semantic category and ingestion health.
3. **Journeys** — complete session histories, outcomes, recovery, duration and supported indicators.
4. **Tasks and funnels** — transaction starts, ordered steps, completion, abandonment, recovery and before/after comparisons.
5. **Fields** — configured question complexity, required status, interaction coverage, dwell, validation, correction and safe length distributions.
6. **Events** — event/action/key-event rankings, trends, semantic entity filters and definitions.
7. **Cohorts** — visit maturity, outcome, recurring journey patterns, movement and like-for-like comparisons with suppression.
8. **Model and explainability** — dimension definitions, exact rules, supported evidence, alternative explanations, version and known limitations.
9. **Data quality and governance** — collection freshness, drop/acceptance rates, semantic-key coverage, unlabelled controls, consent state, retention, schema versions and audit/export controls.

## Delivery sequence

### Release A — analytics foundation

- versioned publisher configuration for services, transactions, tasks, steps, questions and fields, including required/optional status, question and transaction complexity, configured outcomes and key events;
- task/step/field storage and aggregate report APIs;
- semantic coverage and data-quality reporting;
- custom range and shared comparison contract.

### Release B — dashboard breadth

- Overview and Realtime reports;
- event/key-event, page/task/control and field reports;
- funnels, completion/abandonment and recovery;
- accessible aggregate CSV plus source/filter/freshness/caveat metadata.

### Release C — behavioural depth

- idle/visibility lifecycle;
- help and search lifecycles;
- repeatability, recency, celeration and cohort movement;
- coarse environment/input-mode evidence after accessibility and privacy review;
- intervention annotations and outcome comparisons.

### Release D — governed intelligence

- deterministic model explanation;
- analyst recommendations with evidence and uncertainty;
- aggregate natural-language queries only after RBAC, redaction, k-anonymity, audit, citation and refusal evaluations pass;
- user-controlled adaptive assistance only after separate consent, accessibility, DPIA and experiment gates.

## Completion criteria for this roadmap

The roadmap is complete only when every gap row is either implemented with contract, test, dashboard and live evidence; explicitly rejected in governance; or retained as an owned gap with acceptance criteria and release boundary. A larger dashboard alone does not complete the behavioural model.
