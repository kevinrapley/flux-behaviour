# Contributing

Use an approved branch prefix. Make the smallest reviewable change. Run local validation. Update evidence files when controls, risks or product behaviour change.

Required checks:

```bash
npm test
npm run validate
npm run security:secrets
```

Prototype promotion must not include secrets, account identifiers, raw telemetry, personal data or environment-specific configuration.
