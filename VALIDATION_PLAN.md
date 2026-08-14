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
| P2 | About 20 known Linux headless/tool baselines | Implemented; 1/20 observed | Each target is SHA-pinned and produces a sandbox report or explicit inconclusive result |
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
- P4 GREEN: promotion requires all 20 configured baseline targets, one fresh sandbox observation per target, consistent expected outcomes, and exact SHA/DSH/platform/validator bindings.
- Repeated runs for the same repository SHA now receive distinct report IDs and immutable nested report paths, so historical evidence is preserved instead of overwritten.
- `npm run validate:promote` is observation-only by default. Public output requires both a passing quality gate and explicit `--publish`; a blocked publish cannot write `src/data/validation.json`.
- Public passing records require source SHA, DSH version, platform, and validator version. External Verified README and repository override URLs remain historical `recorded` evidence only and no longer affect current Verified counts or ordering.
- Published records automatically become `expired` when the current DSH version, platform, or validator version changes; a contract test keeps that target synchronized with `validation/baseline.json`.
- Website and embedded plugin-store install commands append `#<sourceSha>` only when the promoted current validation record is verified.
- Current promotion observation is blocked at 0/20 retained baseline targets. The earlier calculator live run remains noted as P2 execution evidence, but its report is not present in the promotion input captured at that checkpoint. `src/data/validation.json` therefore remained unchanged and empty.
- Final checks: 37 test files and 182 tests pass; coverage is 98.6% statements, 89.88% branches, 98.88% functions, and 99.04% lines; TypeScript and the 1835-page Astro build pass; the rebuilt embedded plugin passes 41 focused tests.
- P0-P4 contain no external Issue creation path. P5 remains deferred.
- Next activation step: retain one fresh sandbox report for every baseline target, review the observed mismatch rate, then run the explicit P4 publish command. Do not begin P5 as part of that activation.
- Follow-up review started: verify that duplicate delivery of an otherwise valid report is deduplicated without being counted as an evidence-binding mismatch. This changes only promotion metrics, not eligibility requirements or publication state.
- Follow-up GREEN: promotion now counts binding mismatches before deduplicating valid observations; 4 focused promotion tests pass, including duplicate delivery and stale-binding coverage.
- Follow-up final check: full coverage and TypeScript pass, `git diff --check origin/main..HEAD` is clean, and the read-only P4 observation remains blocked at 0/20 with `published: false`.

### 2026-08-14 - Single-plugin observation

- User authorized one validation-flow test. Selected baseline target `omdsh-dev/dsh-tool-calculator` at repository ID `1323526209` and source SHA `701f6549b4e1b648351403dc8a18a9bc9a2b713d`.
- Scope is one P2 Linux host/tool observation using DSH `0.1.0-rc.6` and validator `0.1.0`. It may retain a sanitized report, but must not publish P4 status, modify `src/data/validation.json`, or create an Issue.
- Observation passed in 9.353 seconds: `discovered -> recognized -> structure_passed -> queued -> running -> install_passed -> runtime_passed -> smoke_passed -> verified`.
- All 13 recorded structure checks passed. Trivy, OSV-Scanner, and Gitleaks reported no blocking vulnerability or secret findings; the report has no failure attribution.
- The disposable container and volume were removed after postflight. The sanitized report is retained under `validation/reports/baseline/1323526209/701f6549b4e1b648351403dc8a18a9bc9a2b713d/`.
- Read-only P4 observation now sees 1/20 targets. Promotion remains blocked with `published: false`; `src/data/validation.json` is unchanged and no Issue was created.

### 2026-08-14 - Manual P1 shadow observation

- User authorized one manual P1 operation test. Selected the first stable catalog entry, `SepineTam/mcp-for-stata` at repository ID `956330003`, and isolated output under `validation/reports/manual-p1/`.
- Scope is discovery, execution-type recognition, pinned repository snapshot, non-executing structure checks, Trivy/OSV/Gitleaks scanning, and sanitized shadow report retention. It must not run third-party build/plugin code, publish validation state, or create an Issue.
- The P1 operation completed with `discovered: 1`, `reportsWritten: 1`, no snapshot load failure, and no public-state mutation. The report recognized `channel-mcp` and pinned source SHA `e5b25dc90058001c942fb7ef851637c9f5728486`.
- The result is `inconclusive` and not queueable: OSV-Scanner was unavailable, so attribution is `infrastructure / SCANNER_UNAVAILABLE`. The Python MCP repository also has no Node `package.json` or Node entrypoint; current structure rules record those failures but must not turn the scanner outage into a plugin failure.
- No plugin/build code or sandbox validator ran. The sanitized report is retained under `validation/reports/manual-p1/956330003/e5b25dc90058001c942fb7ef851637c9f5728486/`; `src/data/validation.json` remains unchanged and no Issue was created.

### 2026-08-14 - P4 single-observation policy

- User changed P4 promotion from at least two fresh observations per target to one. Preserve full baseline coverage, exact repository/SHA/DSH/platform/validator bindings, expected outcomes, and conflicting-outcome rejection.
- Current catalog snapshot contains 826 entries: 381 plugins, 45 skills, 20 channels, 3 collections, 26 applications, 25 directories, 14 infrastructure projects, and 312 unknown entries. The validation-eligible display types total 449; only 20 host/tool targets currently have a pinned live-sandbox baseline.
- RED intent: one fresh verified report for every configured baseline target must pass promotion and produce public records, with no repeat-observation block reason or metric.
- GREEN: removed the repeat-observation block reason and metric. One fresh report for each of all 20 baseline targets passes promotion and produces 20 public records; exact bindings, full coverage, conflicting outcomes, and unexpected outcomes remain enforced. Seven focused promotion and CLI tests pass.
- Final verification: 37 test files and 185 tests pass; coverage is 98.63% statements, 89.88% branches, 98.91% functions, and 99.06% lines. TypeScript and `git diff --check origin/main..HEAD` pass. Read-only promotion sees 1/20 targets, is blocked only by baseline coverage, and remains `published: false`.

### 2026-08-14 - Bounded full-chain publication

- User authorized the validation module to process the full catalog-to-store chain while remaining independent from catalog discovery and explicitly required bounded concurrency rather than launching hundreds of validators together.
- Selected architecture: catalog sync publishes an immutable catalog artifact; validation runs the 20-target canary serially, then 20 stable catalog shards with at most four jobs in parallel and one candidate at a time inside each shard; a final trusted job promotes, builds, and deploys only after the canary and every shard complete.
- Third-party validation jobs receive no deployment credentials. Missing Web/Channel/Collection/native contracts become retained `inconclusive` reports; they must never be promoted by pretending a validator ran.
- Existing mature references remain OpenSSF Scorecard and StepSecurity Harden-Runner, both active Apache-2.0 projects. GitHub Actions native matrix and concurrency controls are used for scheduling to avoid adding an orchestration dependency.
- RED scope: correct the OSV v2 `scan source` command, define a sequential dynamic candidate runner, separate canary gate reports from candidate publication reports, and enforce catalog-artifact/concurrency/credential boundaries in Workflow tests.
- RED checkpoint `6040cc6` captured the intended failures before production changes: the candidate runner was missing, OSV v2 lacked the `source` subcommand, promotion could not isolate canary evidence, and the workflows lacked the catalog artifact and trusted publish chain.
- GREEN: `validate:candidates` consumes P1 structure reports in stable repository-ID order. Host/Tool and Command candidates reuse the pinned archive and constrained Linux Loader sandbox; unsupported or missing Web/Channel/Collection/Skill/native contracts retain explicit `inconclusive` reports. The batch loop awaits each candidate, continues after an infrastructure exception, and never runs two candidates concurrently inside a shard.
- Corrected the pinned OSV-Scanner v2.5.0 invocation to `scan source --format=json --recursive /workspace`, resolving the observed false `SCANNER_UNAVAILABLE` result caused by the obsolete command shape.
- `Sync catalog` now runs daily or manually, deploys catalog discovery independently, and uploads `plugin-catalog-snapshot`. A successful main-branch sync triggers `Validate plugins`; manual validation remains independent and uses the checked-in snapshot.
- The validation workflow runs all 20 canary targets serially and enforces the P4 gate before candidate work. It then runs 20 fixed catalog shards with matrix `max-parallel: 4`; each shard performs P1 and candidate validation serially. One complete validation workflow is allowed at a time, so the maximum third-party sandbox concurrency is four.
- Each P1 shard must write one report per discovered entry with zero snapshot load failures. It may continue gathering evidence after an individual load failure, but any incomplete shard fails after processing and prevents the trusted publish job from running.
- Canary and candidate artifacts are kept separate. Promotion gates only on canary evidence, merges canary and candidate reports for publication, and emits at most one latest verified record per numeric repository ID. The final install command remains bound to the promoted source SHA.
- Deployment SSH credentials exist only in the final `publish` job after canary and all 20 shards succeed. P0-P4 still request only `actions: read` and `contents: read`, contain no Issue permission, and contain no Git commit or push path.
- GREEN verification: 5 focused workflow/runner/scanner/promotion files pass 15 tests; the complete suite passes 38 files and 189 tests. Coverage is 98.63% statements, 89.88% branches, 98.91% functions, and 99.06% lines. TypeScript passes, YAML parsing finds the expected `baseline`, `validate`, and `publish` jobs, and Astro builds 1835 pages.
- No full-catalog Action, live deployment, or hundreds-plugin local execution was started in this implementation run. The current observed canary evidence remains 1/20 until the workflow is published and run.
- Evidence retention is not yet permanent: GitHub Action artifacts are configured for 30 days. Permanent sanitized-history storage requires a separately authorized durable backend or repository-write policy; do not claim the artifact archive satisfies the permanent-history requirement.
