# Flux Behaviour

Flux Behaviour is the production-oriented repository for Flux: a consent-based behavioural analytics product for digital services.

This repository is a governed reset from `kevinrapley/flux-behavioural-analytics`. The prototype repository contains valuable lineage: consent-based instrumentation, behavioural scoring, a Cloudflare Worker collector, static dashboards and governance artefacts. It is not copied directly into this repository because prototype code and environment configuration must be reviewed before production use.

## Product boundary

Flux Behaviour may process consented interaction metadata such as timings, navigation events, error patterns, help usage and aggregate behavioural signals. It must not collect typed values, free-text content, passwords, direct identifiers, unconsented events or raw telemetry exports.

Flux is service-improvement evidence. It is not surveillance tooling. It must not make eligibility, enforcement, fraud or benefit decisions.

## Current status

Status: governed foundation. Runtime product code has not yet been promoted.

The repository currently provides branch posture, CODEOWNERS, security policy, CI scaffolding, assurance records, a harm register, migration controls and local validation scripts.

## Repository layout

```text
.github/                  GitHub templates and CI workflows
contracts/                Repository contract notes
docs/                     Product, architecture, migration, governance and security docs
scripts/                  Local validation scripts
tests/                    Repository posture tests
agent-evidence.yaml       Evidence for the foundation change
conformance-matrix.yaml   Control conformance record
gap-register.yaml         Open assurance gaps
github-settings.yaml      Desired GitHub posture
harm-register.yaml        Public-service harm register
repository-contract.yaml  Product and repository quality gates
```

## Local validation

```bash
npm test
npm run validate
npm run security:secrets
npm run sbom
```

These checks are foundation checks. They do not replace CodeQL, dependency review, accessibility testing, DPIA, SBOM attestation, production release gates or GitHub API verification.

## Promotion rule

No prototype artefact is production-ready by default. Each promotion PR must state the source artefact, what changed for security and privacy, what tests were added, which evidence was updated and what residual risk remains.
