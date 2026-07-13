# Event and service-entity reports

Flux turns the consented interaction stream into aggregate reports for the selected period and its like-for-like predecessor. These reports extend the publisher service model; they do not infer purpose from DOM position, visible text or URLs.

## Event report

The event report contains:

- ranked event class and action combinations;
- the number and share of event-active journeys that used each event;
- change in interaction volume from the previous comparable period;
- a complete daily interaction and configured key-event trend for bounded date ranges;
- configured key-event counts, journey reach, publisher outcome labels and outcome types;
- ranked semantic pages, forms and controls with their configured service-model purpose.

The journey-rate denominator is the number of distinct sessions with an event in the selected occurrence-time window. It is not the number of sessions that happened to start in that window, which prevents a session spanning a period boundary from producing rates above 100%.

## Service performance

Every resolved event is attributed to each configured ancestor frozen in its event-time context. Separate accessible tables cover transactions, tasks, steps, questions and fields. Each row reports:

- interactions and unique journeys;
- journeys that entered or exited through that entity among peers of the same type;
- journeys reaching a configured success outcome;
- journeys containing an explicit help, validation, revisit or rapid-click friction signal;
- average elapsed time between the first and last interaction with that entity in a journey;
- journey-volume change from the previous comparable period;
- publisher-declared question or transaction complexity and field required status where available.

Average elapsed time is labelled explicitly and must not be treated as dwell or as proof of difficulty. Distribution and uncertainty reporting remains part of DASH-05.

## Version, privacy and interpretation

Key-event, element and entity evidence is restricted to the exact currently published model key and version. Retired event-time context is preserved but is not relabelled as current evidence.

The response contains aggregate counts, controlled model labels and bounded timings. It contains no visitor identifiers, session identifiers, typed values, page content or raw-event export. Low sample sizes remain visible as sample sizes and must not be presented as conclusive evidence; formal suppression and uncertainty treatment remains an open release requirement.
