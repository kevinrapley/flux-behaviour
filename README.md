# Flux Behaviour

Flux Behaviour is the production-oriented repository for Flux: a consent-based behavioural analytics product for digital services.

This repository is a governed reset from `kevinrapley/flux-behavioural-analytics`. The prototype repository contains valuable lineage: consent-based instrumentation, behavioural scoring, a Cloudflare Worker collector, static dashboards and governance artefacts. It is not copied directly into this repository because prototype code and environment configuration must be reviewed before production use.

## Product boundary

Flux Behaviour may process consented interaction metadata such as timings, navigation events, error patterns, help usage and aggregate behavioural signals. A publisher may analyse ordinary text fields locally after consent and send only bounded, non-reversible linguistic counts under the published contract. Flux must not collect typed values, words, suggestions, passwords, direct identifiers, unconsented events or raw telemetry exports.

Flux is service-improvement evidence. It is not surveillance tooling. It must not make eligibility, enforcement, fraud or benefit decisions.

## Current status

Status: governed foundation with early runtime code. The event contract, runtime validator, collector scaffold (storage disabled), consent-gated SDK tag and a GOV.UK demo prototype have been promoted. Collector storage, aggregation and production deployment have not.

The repository also provides branch posture, CODEOWNERS, security policy, CI scaffolding, assurance records, a harm register, migration controls and local validation scripts.

## Adding Flux to a service

Services add Flux like other analytics tags: a snippet plus a hosted module, configured with a collector endpoint. Events are consent-gated, metadata-only and validated against the published contract in the browser before transport and again at the collector. See `docs/instrumentation/tag-integration.md`.

## Demo prototype

`npm run demo:serve` builds and serves a GOV.UK Frontend prototype at `http://localhost:4321/`: an instrumented demo journey with a consent banner and live event log, and a dashboard of behavioural signals following ONS Charts conventions (fixture data while storage is disabled). See `docs/product/demo-prototype.md`.

## Repository layout

```text
.github/                  GitHub templates and CI workflows
contracts/                Repository contract notes
demo/                     GOV.UK demo prototype templates, styles, assets and fixtures
docs/                     Product, architecture, migration, governance and security docs
scripts/                  Local validation and demo build scripts
src/                      Event contract, collector, Cloudflare adapter and SDK tag
tests/                    Repository posture and runtime tests
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
