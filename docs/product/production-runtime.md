# Production runtime

Flux Behaviour Pages serves a D1-backed API at `/api/collect`, `/api/auth/create-account`, `/api/auth/request-otp`, `/api/auth/verify-otp` and `/api/dashboard/researchops`.

The collector accepts only consented, metadata-only events for the `researchops` tenant from its configured origins. It stores a random, browser-held visitor ID and a browser-session ID; neither is an account identifier. The dashboard builds a plain-language journey narrative from controlled event metadata, never typed values.

OTP delivery requires the protected Pages secrets `FLUX_AUTH_SECRET`, `RESEND_API_KEY` and `FLUX_EMAIL_FROM`. The application must remain unavailable for OTP sign-in until the sending provider is configured and verified.

Live collection is not release approval. DPIA, accessibility evidence, retention/deletion policy, production rate limiting and incident controls remain release blockers.
