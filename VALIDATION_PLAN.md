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
| P1 | Discovery, execution-type recognition, structure check, shadow workflow | Implemented; observation pending | Full catalog produces sanitized reports; `validation.json` remains unchanged |
| P2 | About 20 known Linux headless/tool baselines | Implemented; 1/20 observed | Each target is SHA-pinned and produces a repeatable sandbox report or explicit inconclusive result |
| P3 | DSH Web + Playwright, collection and channel/MCP validators | Implemented; live Web observation pending | Validator-specific fixtures pass without real credentials or external services |
| P4 | False-positive observation gate, Verified promotion, SHA-pinned install | Implemented; promotion blocked | Promotion refuses insufficient or stale evidence and accepts a passing observed baseline |
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
- P1 snapshot/scanner GREEN: 30 focused tests pass. Numeric repository identity is revalidated, default branches resolve to full SHAs, truncated trees are rejected, source blobs are not downloaded, and sanitized Trivy/OSV/Gitleaks adapters use fixed container versions and read-only source mounts.
- P1 workflow GREEN: 38 focused tests pass. Catalog discovery is stable-sharded, fixed-SHA archives are expanded in a non-root networkless container, one repository failure cannot abort a shard, and scheduled CI uploads artifacts only with `contents: read`.
- TypeScript checks pass with the one-shot `--ignoreDeprecations 6.0` flag; the repository's existing `baseUrl` setting blocks an unqualified TypeScript 7 check.
- P1 full-catalog observation remains open until the sharded CI run completes; no public status is written before that gate.
- P2 GREEN: the 20-entry baseline is bound to numeric repository IDs and full source SHAs. Acquisition and execution are separate; execution is non-root, networkless, secret-free, `linux/amd64`, resource-bounded, and disposable.
- P2 live evidence: the calculator sample completed `queued -> running -> install_passed -> runtime_passed -> smoke_passed -> verified`; its container and volume were removed. The other 19 baseline targets remain unobserved, so this is not yet a baseline quality result.
- P3 GREEN: Web/Playwright, collection, channel/MCP, and validator-routing contracts pass 15 focused tests. Missing contracts or unsupported platforms become `inconclusive` rather than false failures.
- P3 image evidence: `dsh-web-validator:0.1.0` built for `linux/amd64`, runs as `pwuser`, and loads Playwright 1.55.0, `ws` 8.18.3, and DSH 0.1.0-rc.6 from the trusted validator path.
- P3 has not yet observed a real Web plugin contract; no Web result is eligible for promotion.
- Combined P0-P3 validation suite: 16 files and 66 tests pass; TypeScript passes with `--ignoreDeprecations 6.0`.
- P4 RED: promotion modules, repeated evidence retention, complete public bindings, legacy trust isolation, and SHA-pinned embedded install commands failed for the intended missing behavior.
- P4 GREEN: promotion requires all 20 configured baseline targets, at least two distinct fresh sandbox observations per target, consistent expected outcomes, and exact SHA/DSH/platform/validator bindings.
- Repeated runs for the same repository SHA now receive distinct report IDs and immutable nested report paths, so historical evidence is preserved instead of overwritten.
- `npm run validate:promote` is observation-only by default. Public output requires both a passing quality gate and explicit `--publish`; a blocked publish cannot write `src/data/validation.json`.
- Public passing records require source SHA, DSH version, platform, and validator version. External Verified README and repository override URLs remain historical `recorded` evidence only and no longer affect current Verified counts or ordering.
- Website and embedded plugin-store install commands append `#<sourceSha>` only when the promoted current validation record is verified.
- Current promotion observation is blocked at 0/20 retained report sets and 0/20 repeatable targets. The earlier calculator live run remains noted as P2 execution evidence, but its report is not present in the current local promotion input. `src/data/validation.json` therefore remains unchanged and empty.
- Final checks: 37 test files and 178 tests pass; coverage is 98.6% statements, 89.88% branches, 98.88% functions, and 99.04% lines; TypeScript and the 1835-page Astro build pass; the rebuilt embedded plugin passes 41 focused tests.
- P0-P4 contain no external Issue creation path. P5 remains deferred.
- Next activation step: retain two fresh sandbox reports for every baseline target, review the observed mismatch rate, then run the explicit P4 publish command. Do not begin P5 as part of that activation.
