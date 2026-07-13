# Lifecycle analytics

Status: aggregate MODEL-12 evidence implemented for the authenticated dashboard.

Flux reports whether consented journeys recur and whether comparable service-friction signals change over time. It does not claim that a person has learned, improved or lost ability.

## Report contract

- Recency uses the interval between a selected-period journey and that pseudonymous visitor's previous consented journey. Median, 90th percentile and fixed interval buckets require at least five repeat journeys; non-zero buckets smaller than five are suppressed.
- Frequency reports selected-period journeys per consented visitor only when at least five visitors are represented. Visitor identifiers are used inside the aggregate query and never returned by the API.
- Visit-maturity movement compares first-time, returning (second or third) and established (fourth or later) journeys. Each named current or previous group requires five journeys before its share or change is shown.
- Celeration compares the proportion of journeys with validation errors, contextual-help use and field revisits against the like-for-like previous period. It shows affected journeys, denominators, percentage-point movement and a neutral direction label.
- The existing dashboard range contract bounds custom selections to 366 days. All-time remains an explicit analyst selection and is not given a previous-period comparison.

## Interpretation limits

Lower help, error or revisit rates do not prove learning or service improvement. Audience mix, task mix, collection coverage, model coverage, accessibility needs and service changes are alternative explanations. The report is descriptive, aggregate service evidence; it must not support person-level targeting, eligibility, enforcement, casework or automated decisions.

MODEL-12 is only one lifecycle slice. Idle/visibility, contextual-help states, content-free search lifecycles, environment evidence and correction context remain governed gaps under MODEL-08 through MODEL-11 and MODEL-13.
