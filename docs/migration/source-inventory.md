# Source Inventory

Source repository: `kevinrapley/flux-behavioural-analytics`.

Read during foundation: `README.md`, `package.json`, `tsconfig.json`, `wrangler.toml`, `workers/collector_worker.ts`, `public/flux_instrumentation_guide_v6.md` and `public/governance_pack/README.md`.

## Promotion classification

| Source area | Classification | Action |
| --- | --- | --- |
| Consent and privacy principles | Promote concept | Rewrite into product docs and acceptance criteria. |
| Scoring config | Promote after review | Validate schema, thresholds, references and explainability. |
| Instrumentation guide | Promote after review | Align with no-PII schemas and accessibility evidence. |
| Cloudflare Worker | Rewrite | Preserve route intent, redesign validation, deletion, auth, rate limits and storage. |
| `wrangler.toml` | Block direct copy | Replace with sanitized example and secret-binding documentation. |
| Static prototypes | Review and selectively rewrite | Do not treat as production UI. |
| Governance pack | Promote and expand | Convert into maintained docs with gaps and blockers. |

No runtime source file is promoted in this foundation change.
