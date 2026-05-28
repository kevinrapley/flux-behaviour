# Agent Operating Instructions

Treat this repository as a governed product system.

## Required reading before changes

1. `README.md`
2. `AGENTS.md`
3. `RECENT_LEARNINGS.md`
4. `CONTRIBUTING.md`
5. `SECURITY.md`
6. `repository-contract.yaml`
7. `github-settings.yaml`
8. `conformance-matrix.yaml`
9. `gap-register.yaml`
10. Relevant files under `docs/`

## Branch rules

Use only `feature/`, `chore/`, `test/`, `fix/`, `perf/` or `hotfix/`. Do not use `claude/`, `codex/`, `bugfix/`, `experiment/` or unclassified prefixes.

## Mutation rules

Prefer small reviewable commits. Do not copy secrets or environment-specific configuration from the prototype repository. Use Git object or patch-capable workflows for large changes.

## Evidence rules

Update `agent-evidence.yaml`, `conformance-matrix.yaml`, `gap-register.yaml`, `RECENT_LEARNINGS.md` and `harm-register.yaml` when their controls are affected. Do not claim checks passed unless the command was run.
