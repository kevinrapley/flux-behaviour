# Transaction funnel and field reports

Flux turns the exact published service model and its frozen event-time context into two aggregate reports. Neither report guesses meaning from markup, URLs or entered content.

## Transaction funnels

A journey starts a configured transaction when its first model-resolved event for that transaction occurs in the selected period. Steps follow the publisher-declared task and step order. A journey reaches a later step only when it has reached every preceding configured step in order; an out-of-order visit cannot qualify a later step unless the missing sequence is subsequently completed. Session activity used for abandonment comes from the collector's server timestamp rather than the browser occurrence clock.

Each transaction reports:

- started journeys, configured successes and completion rate;
- configured failures;
- journeys still in progress;
- abandonment after the session has been inactive for 30 minutes without a configured outcome;
- journeys with explicit validation, repeated-click, revisit or help friction;
- recovery when `error.recovered` or any configured success follows that friction, including a later success after an earlier success in the same transaction;
- median and 90th-percentile completion time;
- ordered step reach and drop-off from the preceding step;
- completion-rate movement against the previous comparable period.

The completion and abandonment denominator is started journeys. The recovery denominator is journeys with explicit friction. An all-time selection has no comparison period and is labelled accordingly. A zero-activity configured transaction remains visible rather than disappearing from the report.

## Field coverage

A field is exposed when a journey reaches its configured parent step. Interaction requires a resolved event for that field. Non-interaction is reported neutrally and is not called a skip. A required-field skip attempt is counted only when explicit validation metadata reports `reason=empty_field`.

Each configured field reports:

- required or optional status and publisher-declared question complexity;
- exposed, interacted and non-interacting journeys;
- coverage and previous-period movement;
- journeys with positive edit evidence;
- explicit validation and required empty-field validation attempts;
- configured success occurring after the field interaction in the same journey and transaction;
- aggregate Backspace/Delete corrections;
- pre-input dwell buckets;
- safe value-length buckets.

The dwell buckets are under 1 second, 1–5, 5–15, 15–60 and 60 seconds or more. Length buckets are empty, 1–20, 21–100, 101–500 and more than 500 characters. When a field is blurred more than once, the dwell and length distribution uses its latest blur rather than the largest transient value. Flux never returns entered values, words, fragments or per-journey field contents from these reports.

## Interpretation limits

Funnel order describes the configured happy path, not every valid route through a service. Abandonment means a closed session without a configured outcome; it does not establish why the visitor stopped. Non-interaction does not prove avoidance or error. Counts and rates remain descriptive service evidence for human investigation, not judgements about an individual.
