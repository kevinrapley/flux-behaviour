# Realtime analytics

The realtime dashboard answers whether ResearchOps is receiving activity now and whether the Flux collection pipeline is fresh. It deliberately provides operational aggregates rather than a live view of individuals.

## Report contract

The authenticated ResearchOps dashboard includes:

- active sessions in the last 5 minutes;
- active sessions in the last 30 minutes;
- accepted interactions in the last 5 and 30 minutes;
- a zero-filled 30-minute interactions-per-minute series;
- the latest server acceptance time;
- ingestion freshness classified as live, delayed, stale or no data.

Live means the latest accepted interaction is at most two minutes old. Delayed means more than two and at most ten minutes. Stale means more than ten minutes. No data means no accepted event exists in the realtime window.

## Acceptance time

Migration `0005_event_ingestion_time.sql` adds indexed `accepted_at_ms` server time. The collector writes it from its own clock when an event is accepted. This is distinct from `occurred_at_ms`, which describes the browser-reported interaction time and is unsuitable for measuring pipeline freshness.

Existing rows are backfilled from occurrence time so the column is queryable after migration. That historical fallback is not evidence of actual server latency; freshness becomes authoritative only for events accepted after this migration.

## Privacy boundary

Realtime responses contain counts, minute buckets, timestamps and status only. They expose no session ID, visitor ID, account identity, page content, event narrative, precise location or live user snapshot. Individual journey inspection remains a separate authenticated, intentional workflow.

## Accessibility and responsive behaviour

The visual minute chart has a plain-language accessible summary. A disclosure provides the complete minute-by-minute table. Desktop and 390px mobile layouts have been checked with populated data; the panel and table stay within the page viewport.
