# Dashboard information architecture and uncertainty

The authenticated ResearchOps dashboard is organised into nine URL-backed report areas with one shared range, comparison and aggregate-export control set:

1. Overview
2. Realtime
3. Journeys
4. Tasks and funnels
5. Fields
6. Events
7. Cohorts
8. Model and explainability
9. Data quality and governance

The report navigation uses native links, preserves every active filter in each destination and marks the current area with `aria-current="page"`. The authenticated dashboard runtime updates the URL without reloading the dataset and moves focus to the selected report heading. Links retain meaningful destination URLs for opening, copying and reload restoration; the analytics data and report selection require the dashboard JavaScript runtime. Wide navigation and evidence tables are horizontally contained on narrow screens.

## Uncertainty contract

The overview reports the observed numerator, denominator, point rate and Wilson 95% interval for returning visitors, configured journey completion and journeys with explicit friction. A zero denominator produces no rate claim. Counts are clamped to their denominator before calculation so inconsistent source rows cannot produce impossible intervals.

The interval is descriptive. Dashboard copy explicitly says that it does not correct collection gaps, selection effects, repeated observations or model error and does not establish cause. Samples below 5 are labelled very limited; samples below 30 are labelled with a wide-interval caution. This treatment complements existing funnel median and 90th-percentile duration, field dwell and length distributions, visible sample sizes and k=5 cohort/comparison suppression.

## Data quality and governance area

The governance area brings together:

- server-acceptance freshness;
- current published-model mapping coverage and retired-version counts;
- event-schema and model versions;
- the aggregate-only export boundary;
- explicit unknowns for end-to-end acceptance/drop rates, consent-choice denominators and production retention/deletion controls.

Unknown controls remain visible rather than being presented as healthy. The area contains aggregate operational and model evidence only—never visitor/session identifiers, narratives, metadata payloads, entered values or raw events.
