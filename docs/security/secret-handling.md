# Secret Handling

Secrets must not be committed.

The prototype Cloudflare configuration contains a committed delete secret pattern. Do not copy it into this repository.

Keep binding names in configuration. Store values in the deployment platform secret manager. Rotate any secret that was ever committed. Keep local `.env` files untracked.
