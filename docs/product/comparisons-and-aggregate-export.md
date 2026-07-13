# Comparisons and aggregate export

The authenticated ResearchOps dashboard supports the last 24 hours, 7 days, 30 days, 90 days, one year, all time and a custom inclusive date interval. Custom intervals must be valid UTC calendar dates, may not extend into the future and are limited to 366 days. Every bounded interval has a like-for-like preceding period.

Analysts can compare aggregate journeys by visit maturity, configured outcome path, configured task or coarse interaction mode. Comparisons are descriptive service evidence, not causal or person-level conclusions. Every group with fewer than five journeys is suppressed, and no protected characteristic, entered value or visitor identifier is used as a dimension.

CSV export is restricted to authenticated tenant members and an allow-list of aggregate dashboard reports. Each row includes the selected range and comparison, generation time, tenant, published model version, event schema version, suppression note and interpretation caveat. Exports contain metric rows only, are capped at 5,000 rows, neutralise spreadsheet formula prefixes and never expose raw events, narratives, metadata, visitor IDs, session IDs or entered values.

The dashboard keeps native labels, date inputs, selects, links and semantic tables. Wide comparison tables are contained horizontal regions on narrow screens.
