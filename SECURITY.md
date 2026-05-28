# Security Policy

Flux Behaviour is not production-ready. This repository is a governed foundation.

## Reporting

Report exploitable vulnerabilities, secrets, authentication flaws or data leakage privately to `@kevinrapley`.

## Principles

- No committed secrets.
- Consent before telemetry.
- Metadata-only event capture.
- Runtime secrets in platform secret managers.
- Least-privilege GitHub Actions.
- Pull-request review before mainline changes.
- Code scanning and dependency review before production release.

Do not commit `.env` files, API keys, Cloudflare secrets, tokens, account-specific values, raw event logs or personal data.
