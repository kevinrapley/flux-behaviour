# Production runtime

Flux Behaviour Pages serves a D1-backed API at `/api/collect`, `/api/auth/google/start`, `/api/auth/google/callback` and `/api/dashboard/researchops`.

The collector accepts only consented, metadata-only events for the `researchops` tenant from its configured origins. It stores a random, browser-held visitor ID and a browser-session ID; neither is an account identifier. The dashboard builds a plain-language journey narrative from controlled event metadata, never typed values.

Google sign-in requires protected Pages secrets `FLUX_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The Google OAuth client must register `https://flux-behaviour.pages.dev/api/auth/google/callback` as its production redirect URI. A Google identity is attached to the pre-seeded Flux account by verified Google email and is stored separately from visitor and session analytics data.

The tracker creates persistent visitor and session identifiers only after a visitor grants consent; revoking consent clears both identifiers. Services can supply an explicit `data-flux-key` for a stable semantic control name. Otherwise, the tracker creates a neutral structural key from the element type and its control position on the page. It never derives an analytics key from visible text, accessible labels, form values, names, IDs or URLs. Email, telephone, password and one-time-code fields are excluded entirely from auto-capture. The dashboard groups controlled narrative events by their pseudonymous session, including whether the session belongs to a returning visitor, and aggregates only approved metadata: event counts, returning sessions, field dwell, character counts, corrections, paste and shortcut categories, validation transitions, help disclosures, submit attempts and neutral control keys.

For each session, Flux calculates the 20 indicators used by the demo model and five composites. The calculation is bounded to observed, consented metadata; an unsupported indicator remains neutral and no value is inferred from identity, text or a protected field. These are service-friction heuristics for human review, not classifications or judgements of an individual. The promoted mapping has not yet completed golden-corpus validation, so it remains governed by GAP-008 and must not support automated or high-stakes decisions.

The dashboard defaults to the last 30 days and supports 7-day, 90-day and all-time views. Visitors, returning visitors, sessions, interactions, completion and friction are calculated cumulatively for the selected period, with like-for-like comparison data and daily audience trends. The primary view is aggregate service evidence and does not expose raw pseudonymous visitor identifiers.

Recent journeys use a bounded event window for responsive overview rendering, but each displayed journey offers an authenticated complete-history request. That request reads the session's full, tenant-scoped event sequence in chronological order and recomputes its indicators from that full sequence.

Live collection is not release approval. DPIA, accessibility evidence, retention/deletion policy, production rate limiting and incident controls remain release blockers.
