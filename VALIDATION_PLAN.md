# DSH Plugin Validation Rollout Plan

Last updated: 2026-08-14

## Objective

Build a reproducible plugin validation pipeline that preserves every stage of evidence, executes untrusted code only inside constrained disposable environments, and grants a current Verified marker only to results pinned to repository ID, source SHA, DSH version, platform, and validator version.

## Success Criteria

- Reports validate against a versioned machine schema and retain the complete state ladder and failure attribution.
- Repository or DSH target changes turn current verification into `expired` and enqueue revalidation without deleting history.
- P1 can discover, classify, and structure-check the catalog in shadow mode without mutating public status.
- P2 can run a pinned Linux headless/tool baseline in a constrained Docker sandbox for approximately 20 configured projects.
- P3 provides Web/Playwright, collection, and channel/MCP validation paths without real accounts or secrets.
- P4 promotes only quality-gated evidence and pins install commands to the validated SHA.
- P0-P4 contain no external Issue creation path.

## Phase Status

| Phase | Scope | Status | Exit Gate |
| --- | --- | --- | --- |
| P0 | Report schema, state machine, invalidation, execution types | Complete | Unit tests cover valid/invalid transitions, history, SHA/DSH/platform/validator expiry, and execution types |
| P1 | Discovery, execution-type recognition, structure check, shadow workflow | In progress | Full catalog produces sanitized reports; `validation.json` remains unchanged |
| P2 | About 20 known Linux headless/tool baselines | Pending | Each target is SHA-pinned and produces a repeatable sandbox report or explicit inconclusive result |
| P3 | DSH Web + Playwright, collection and channel/MCP validators | Pending | Validator-specific fixtures pass without real credentials or external services |
| P4 | False-positive observation gate, Verified promotion, SHA-pinned install | Pending | Promotion refuses insufficient or stale evidence and accepts a passing observed baseline |
| P5 | Opt-in Issue bot, Windows/macOS | Deferred | Requires separate authorization |

## Planned Artifacts

- `src/lib/validation-report.ts`: versioned report parser, state machine, invalidation, and promotion rules.
- `scripts/validation/`: discovery, structure checks, sandbox planning/execution, report writing, and promotion CLI.
- `validation/baseline.json`: curated baseline targets and expected execution types.
- `validation/schemas/`: JSON Schema for reports and baseline configuration.
- `validation/fixtures/`: local safe repositories for deterministic validator tests.
- `.github/workflows/validate-plugins.yml`: manual/scheduled shadow and baseline execution with artifacts only by default.
- `validation/reports/`: sanitized retained evidence; raw sandbox logs remain CI artifacts.

## Safety Gates

- Shadow is the default mode. Publishing requires an explicit `--publish` flag plus a passing promotion gate.
- Structure checks never run lifecycle, build, test, or plugin code.
- Sandbox commands use no secrets, no Docker socket, no writable host source mount, non-root execution, resource/time limits, and controlled networking.
- Security findings produce quarantine evidence only; P0-P4 do not contact plugin authors.
- Infrastructure and policy failures cannot become plugin failures.

## Checkpoints

### 2026-08-14 - Start

- Confirmed current local capabilities: Docker 29.7.2 and DSH 0.1.0-rc.6.
- Confirmed the existing catalog already separates display classification and has a validation feed, but its four-stage summary is not sufficient for the required evidence ladder.
- Selected mature references rather than embedding them: OpenSSF Scorecard for repository posture, OSV-Scanner for vulnerabilities, gVisor as a later Linux hardening path, StepSecurity Harden-Runner for CI egress visibility, and `actions/github-script` only for the deferred P5 trusted Issue job.
- Moved the empty host profile accidentally initialized during CLI inspection to `~/.Trash/dsh-validation-profile-codex-20260814-1937`; no plugin was installed.
- P0 RED: `src/lib/validation-report.test.ts` failed because the report module did not exist.
- P0 GREEN: 8 focused tests passed for the versioned report contract, legal transitions, deterministic failure evidence, binding freshness, and history-preserving expiry.
- Added `validation/schemas/report.schema.json` and the matching strict TypeScript parser/state machine.
- P1 RED: execution routing, non-executing structure checks, scanner failure attribution, security quarantine, and shadow report isolation were defined before implementation.
- P1 core GREEN: 24 focused P0/P1 tests pass. Shadow reports are immutable and atomic, unknown projects remain `unrecognized`, scanner outages are infrastructure failures, and no public validation or Issue writer is reachable.
- Restored the root package metadata after npm added unrelated README-derived fields; retained only the required `yaml` parser dependency.
- Next: add the GitHub fixed-SHA snapshot loader and pinned scanner adapters, then wire the artifact-only shadow workflow.
