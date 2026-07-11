# Production runtime

Flux Behaviour Pages serves a D1-backed API at `/api/collect`, `/api/auth/google/start`, `/api/auth/google/callback` and `/api/dashboard/researchops`.

The collector accepts only consented, metadata-only events for the `researchops` tenant from its configured origins. It stores a random, browser-held visitor ID and a browser-session ID; neither is an account identifier. The dashboard builds a plain-language journey narrative from controlled event metadata, never typed values.

Google sign-in requires protected Pages secrets `FLUX_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The Google OAuth client must register `https://flux-behaviour.pages.dev/api/auth/google/callback` as its production redirect URI. A Google identity is attached to the pre-seeded Flux account by verified Google email and is stored separately from visitor and session analytics data.

The tracker creates persistent visitor and session identifiers only after a visitor grants consent; revoking consent clears both identifiers. Automatically captured elements require an explicit `data-flux-key`, so accessible labels and page content are never exported as analytics keys.

Live collection is not release approval. DPIA, accessibility evidence, retention/deletion policy, production rate limiting and incident controls remain release blockers.
