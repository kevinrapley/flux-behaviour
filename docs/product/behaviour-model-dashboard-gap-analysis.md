# Behaviour model and dashboard gap analysis

Status: source-grounded product gap analysis. This is a delivery roadmap, not evidence that the listed capabilities are implemented.

## Outcome

Flux has a credible consented session recorder and journey-inspection dashboard. It does not yet implement the full behavioural analytics model described across the product documentation, and it does not yet provide the breadth of reporting, comparison and realtime operational views expected of a mature analytics dashboard.

The central architectural gap is a missing publisher-declared service model. Flux records events against semantic element keys, but it has no first-class definitions for services, transactions, tasks, steps, questions, required/optional fields, complexity, intended outcomes or key events. Without that layer, the product cannot reliably compare like with like or turn interaction evidence into task-, field- and service-level insight.

## Sources reviewed

The analysis used the current repository at `140313c` and the following user-provided or source-referenced artefacts. External source locations and access material are retained privately by the product owner; this public register uses descriptive labels only.

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
- 7-, 30-, 90-day and all-time ranges with previous-period overview comparisons;
- visitors, returning visitors, sessions, interactions, daily trends, completion, duration, dwell, correction and friction summaries;
- action ranking, 20 service-friction indicators, privacy-thresholded journey cohorts and complete per-session narratives.

## Gap matrix

Priority uses `P0` for enabling foundations, `P1` for the next complete analytics release, `P2` for model depth and `P3` for governed advanced capability.

| ID | Priority | Capability expected | Current evidence | Gap and acceptance boundary |
| --- | --- | --- | --- | --- |
| MODEL-01 | P0 | Publisher-declared service, transaction, task, step, question and field definitions | Events contain `tenant_id`, role and `element_key`; no configuration tables or contract exist | Add a versioned metadata model with stable IDs, labels, ordering, required/optional status, transaction outcome and retention-safe configuration. Events must resolve to it without exporting page text. |
| MODEL-02 | P0 | Question and transaction complexity | No complexity metadata or baseline exists | Support publisher-declared 1–7 question complexity and a documented transaction roll-up. Dashboard comparisons must adjust effort/error/help interpretation by comparable complexity rather than judging a pause in isolation. |
| MODEL-03 | P1 | Key events and outcomes | `flow.submit` is the only generic completion proxy | Let tenant owners declare multiple key events and outcome types; show counts, rates and paths. Do not assume every submit is success. |
| MODEL-04 | P1 | Transaction and step funnels | Page loads and submits are stored, but no ordered funnel model or abandonment definition exists | Show starts, step progression, completion, abandonment and recovery with explicit denominators, time windows and path definitions. |
| MODEL-05 | P1 | Field interaction coverage | Element counts exist internally; no required/optional field coverage report is rendered | Report journeys interacting with each configured field, required/optional status, skip attempts, validation, dwell, completion and safe length distributions. Never expose entered values. |
| MODEL-06 | P1 | Recovery and resolution | Scoring understands `error.recovered`, but auto-capture does not emit a recovery lifecycle | Correlate validation/help/friction with a subsequent valid action or configured outcome; distinguish recovered from unresolved journeys. |
| MODEL-07 | P2 | Data-disclosure calibration | No required/optional or disclosure-purpose model exists | Measure configured optional-field completion and consent choices only at aggregate service level. Do not infer openness, sociability, education or personality. |
| MODEL-08 | P2 | Idle, visibility and interrupted journeys | Session inactivity creates a new session; no idle episode, visibility or resume events exist | Add bounded idle/hidden/resumed metadata and distinguish reading, interruption and abandonment conservatively. Cross-application identity or content must never be observed. |
| MODEL-09 | P2 | Environment and interaction-mode evidence | `pointer_type` and touch count exist; `env` class has no governed device/browser/OS fields | Add coarse capability and input-mode summaries only where necessary for accessibility/service QA. Avoid fingerprinting, plugin inventories and user-ability inference. |
| MODEL-10 | P2 | Contextual help taxonomy | `assist.help` records a disclosure opening only | Configure help level/type and capture opened, engaged, dismissed and outcome-after-help states. Email/helpdesk/chat content remains out of scope. |
| MODEL-11 | P2 | Search and information-seeking journeys | No search request, refinement, result selection or success lifecycle | Add semantic, content-free search lifecycle events and connect them to configured outcomes. Search terms and result content must not be collected. |
| MODEL-12 | P2 | Repeatability, recency, experience decay and celeration | Returning visitor/session count exists; no interval, movement or like-for-like trend analytics | Show time since previous consented visit, visit frequency, cohort movement and whether comparable error/help/revisit rates improve or worsen. Apply retention limits and uncertainty. |
| MODEL-13 | P2 | Input correction context | Backspace/Delete count exists regardless of whether an editable value was present; no selection/double-click context | Count correction attempts only with meaningful editable state, distinguish selection from empty-field double clicks and avoid penalising held keys. Do not record selected text. |
| DASH-01 | P1 | Realtime overview | Dashboard queries fixed historical ranges only | Add active sessions in the last 5 and 30 minutes, interactions per minute, latest acceptance time and freshness/ingestion health. No live identity map or invasive individual surveillance view. |
| DASH-02 | P1 | Event and key-event reports | Top eight actions only; no configurable key-event panel or event explorer | Provide ranked event classes/actions, trends, key-event rates and drill-down by configured task/page/control with definitions and accessible tables. |
| DASH-03 | P1 | Page, task, step, form and control performance | `controls` is calculated but not rendered; no page/task rankings | Add views, unique journeys, entry/exit, outcome, friction and time panels for each configured semantic entity. |
| DASH-04 | P1 | Flexible comparisons and ranges | 7/30/90/all with automatic previous period only | Add 24-hour, year and custom ranges plus compare-by-period, visit maturity, outcome, task and safe interaction mode. Enforce query and retention limits. |
| DASH-05 | P1 | Distribution and uncertainty | Mostly counts, rates, averages and medians; no distribution/percentile or confidence treatment | Add min/max only where robust, percentiles, sample sizes, suppression and confidence/uncertainty notes. Avoid averages that conceal multimodal struggle. |
| DASH-06 | P1 | Accessible export and report provenance | Chart data table exists; no CSV/export, query definition or data-freshness provenance | Provide screen-reader-first tables and bounded CSV for aggregates, with filters, source, generated time, schema/model version, caveats and suppression notes. No raw-event export. |
| DASH-07 | P2 | Acquisition/source and campaign context | No source/referrer/campaign metadata | Support consented, allow-listed source categories and campaign IDs only when necessary. Strip query strings and identifiers; default to direct/unknown. |
| DASH-08 | P2 | Audience/property panels | Only new/returning and heuristic journey cohorts | Add service-defined, non-sensitive journey properties and comparisons with minimum group sizes. Do not recreate demographic profiling or expose visitor IDs. |
| DASH-09 | P2 | Change-to-outcome action layer | No release, experiment, intervention or annotation model | Let teams annotate releases/interventions, compare before/after evidence and record hypotheses, owners and follow-up decisions. This is the missing bridge from analytics to service action. |
| DASH-10 | P2 | Dashboard information architecture | One long overview page combines audience, health, cohorts, indicators and journeys | Introduce Overview, Realtime, Journeys, Tasks/funnels, Fields, Events, Cohorts, Model/explainability and Data quality/governance report areas with shared filters. |
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
