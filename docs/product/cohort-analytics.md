# Cohort analytics

Status: implemented as privacy-preserving service-improvement analytics. It is not a validated user-classification system.

## Documentation review

The design was grounded in the linked Flux Behavioural Analytics Drive folder, including the original **Behaviour Model**, **Dimensional Analysis**, **Requirements**, **Potential Dashboard Stats**, **Things to think about**, **eCommerce Sales Funnel**, the 2025 **Flux Behavioural Dashboard** workbook and **NLP Admin Dashboard**.

The source material consistently supports three useful questions:

1. Do people become more familiar with the service over repeated visits?
2. Which kinds of journey reach an outcome, encounter friction or recover?
3. Do supported interaction signals form recurring journey patterns worth investigating?

The documents also contain historical ideas that do not meet the governed product boundary. Flux must not infer education, intelligence, personality, openness, conscientiousness or protected characteristics; inspect social profiles or visited links; fingerprint browsers; evaluate password content; or run sentiment analysis over captured free text.

## Cohorts delivered

All cohorts apply to journeys, not people. They use consented, content-free metadata and the selected dashboard period.

### Visit maturity

- **First-time journeys**: the visitor had not previously started a consented session.
- **Returning journeys**: a returning visitor with two or three consented sessions in total.
- **Established journeys**: a returning visitor with four or more consented sessions in total.

This promotes the original requirements for number of visits, repeatability and experience over time without attaching an account identity.

### Outcome paths

- **Completed without observed friction**
- **Completed after friction**
- **Friction without completion**
- **No outcome observed**

Friction is restricted to supported service signals: validation errors, repeated rapid clicks, field revisits and help use. Absence of a signal is not proof that a journey was easy.

### Interaction patterns

The original journey-pattern rules are retained with safer labels and a neutral evidence guard:

- confident navigation;
- careful checking;
- exploration with friction;
- recovery and adaptation;
- assurance seeking;
- no dominant pattern.

A fully neutral score set always produces **no dominant pattern**. This prevents missing evidence from being misreported as careful checking. Pattern calculations use at most the 250 most recent complete journey histories in the selected period and declare when coverage is limited.

## Privacy and interpretation controls

- Named cohort results require at least 5 journeys.
- Smaller groups are suppressed and reported only as an unnamed total.
- Cohorts never include visitor IDs, account identity, typed values or free text.
- The dashboard reports completion, friction, return rate and duration as service evidence, not as judgements about a visitor.
- Pattern labels are heuristic and require golden-corpus and fairness validation before broader interpretation.
- Cohort outputs must not support eligibility, enforcement, fraud, casework or automated decisions.

## Prioritised additions

The documentation suggests the following next improvements, in order:

1. **Task-complexity baselines** — let service owners declare question complexity, then compare dwell, error and help rates against equivalent questions rather than treating all pauses alike.
2. **Experience and recency** — show repeat-visit intervals, time since previous visit and cohort movement over time, with explicit retention limits.
3. **Recovery funnels** — distinguish help or validation followed by successful recovery from unresolved friction.
4. **Field interaction coverage** — show the proportion of journeys interacting with each safe element key, split by required versus optional controls without recording values.
5. **Repeatability and celeration** — trend whether like-for-like help, validation and revisit signals are increasing or decreasing at service level.
6. **Interaction-mode evidence** — compare keyboard, pointer and touch journeys only after an accessibility and false-positive review; never equate an input mode with ability.
7. **Custom ranges and cohort comparison** — add date-range selection and like-for-like cohort deltas once retention policy and query limits are approved.
8. **Natural-language aggregate queries** — only after role controls, prompt redaction, audit logs, source/caveat display and the documented minimum group-size enforcement exist.

These additions must retain dual interpretations. A long dwell can reflect confusion, reading, interruption, careful checking or assistive technology use.
