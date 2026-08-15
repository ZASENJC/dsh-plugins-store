# DSH Plugin Validation Rollout Plan

Last updated: 2026-08-15

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
| P1 | Discovery, execution-type recognition, structure check, shadow workflow | Operational | Full catalog produces sanitized reports; structure advisories do not block installability checks |
| P2 | About 20 known Linux headless/tool baselines | Operational; validator 0.1.1 full rerun pending | Each target is SHA-pinned and produces a repeatable sandbox report or explicit inconclusive result |
| P3 | DSH Web + Playwright, collection and channel/MCP validators | Implemented; generic Web/channel install path observed | Validator-specific fixtures pass without real credentials or external services |
| P4 | False-positive observation gate, Verified promotion, SHA-pinned install | Operational; validator 0.1.1 promotion pending | Promotion refuses insufficient or stale evidence and accepts a passing observed baseline |
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
- Next: define the approximately 20-project P2 baseline and restricted Linux sandbox command/result contract.

### 2026-08-15 - First full-run repair

- The first public validation run stopped safely on Linux archive cleanup ownership; RED/GREEN commits `7a34456` and `77813c0` fixed extraction ownership without allowing root execution.
- The second run completed all 20 canaries but correctly held the 449-repository shard stage at the promotion gate: 13 canaries verified, 6 reported dependency installation failures, and 1 failed structure checks.
- Local pinned-SHA reproduction identified a validator false-positive source: six canaries contain `pnpm-lock.yaml`, while the shared Linux plan always invokes `npm ci` even though the validator image already pins pnpm.
- This repair run will first add RED coverage for lockfile-driven dependency commands and always-retained canary artifacts, then apply the smallest shared planner/workflow fixes.
- Remaining canary failures will be rerun individually. Any genuine plugin or structure failure will stay visible and will not be relabeled as verified; the gate model will be changed only if an explicit negative-control outcome is supported by the baseline contract.
- Exit gate: focused tests, coverage, type checks, workflow YAML parsing, and build pass; validation-only commits are pushed; a fresh full workflow advances beyond canary or exposes a newly diagnosed actionable failure with retained reports.

### 2026-08-15 - Strict-offline decision

- The user selected the strict network-isolation path: plugin installation and execution remain networkless even when that reduces the number of conclusive results.
- Confirmed validator fixes locally: pnpm lockfile selection, bare relative entrypoints, external registry credential detection, loader-only smoke behavior, retained failed canary artifacts, and negative-control gate outcomes.
- Confirmed pinned outcomes: `dsh-stream-rules` and `dsh-tiered-approval` verify; Qwen-MM-Plugins, sandbox-micro, and sandbox-nono have standalone build failures caused by repository-external TypeScript references; sandbox-mxc requires private GitHub Packages credentials.
- Confirmed `dsh-acp-for-bitfun` reaches plugin installation after its entrypoint false positive is fixed. Strict offline installation can lack pnpm registry metadata even when locked package content was acquired, so this validator limitation must be `inconclusive`, not a plugin defect.
- Public validation output must retain failed, structure-failed, and inconclusive current-SHA observations with sanitized Chinese explanations. Only a current `verified` record may grant the Verified marker.
- Exit gate: exact negative canary expectations are recorded; offline cache misses become infrastructure-inconclusive without raw stderr leakage; the public feed exposes the reason; validation-only commits pass required checks, push, and advance a new full workflow beyond canary.

### 2026-08-15 - Strict-offline implementation complete

- Added RED/GREEN checkpoints for lockfile-aware npm/pnpm acquisition, always-retained failed canary artifacts, bare relative entrypoints, external credential detection, loader-only smoke, declared negative canaries, offline installation, and public explanations.
- `dsh-acp-for-bitfun` now completes in approximately three seconds with `OFFLINE_DEPENDENCY_CACHE_MISS`, `infrastructure`, and `inconclusive`; the sanitized report retains no registry URL, package name, token, or stderr.
- Public validation generation now preserves verified, failed, structure-failed, and inconclusive current-SHA observations. The existing detail page displays the sanitized Chinese reason; only sandbox-passed records grant Verified.
- Baseline expectations now match the observed fixed SHAs: three standalone build failures, two inconclusive dependency/credential cases, and fifteen verified controls.
- Verification passed: 39 test files and 202 tests; 98.6% statements, 89.88% branches, 98.88% functions, and 99.04% lines; TypeScript no-emit; all workflow YAML; Astro check/build with 1835 generated pages and no errors.
- Remaining: integrate the remote validation branch tip without including local documentation, push validation-only commits, dispatch the full workflow, and monitor canary plus bounded shards.

### 2026-08-15 - Full-catalog API budget repair

- Run `31821430436` passed the 20-target canary gate with the declared 15 verified, 3 failed, and 2 inconclusive outcomes, then started the 592-repository full run with four concurrent shards.
- Shards 0-11 completed or produced evidence, while shards 12-19 failed at the P1 completeness guard after 484 reports. Later shards failed immediately with no reports, matching exhaustion of the repository-scoped GitHub REST budget.
- Root cause: each P1 repository uses REST for metadata, commit, recursive tree, every structural blob, and archive acquisition. Lowering shard concurrency cannot make that request count fit the hourly budget.
- Repair boundary: keep the current canary identity checks, but make full-catalog P1 resolve one exact SHA per repository, download the public fixed-SHA archive through codeload, and derive structure evidence locally. Candidate archive acquisition must use the same non-REST path.
- Add sanitized shadow summaries to Action logs so future incomplete shards expose repository IDs without leaking raw request errors.
- Exit gate: RED/GREEN tests cover fixed-SHA codeload, local structural inventory, single-request SHA resolution, catalog metadata binding, and summary visibility; rerun the full workflow and manually trigger catalog sync only after a complete validation state artifact exists.

### 2026-08-15 - Archive-backed P1 implementation complete

- RED commit `f48772d` captured the REST tarball, missing archive snapshot, missing catalog metadata binding, and hidden shadow summary contracts.
- Full-catalog P1 now spends one REST request per repository to resolve the default branch through its numeric repository ID. Fixed-SHA source and candidate archives use validated public codeload paths, while structure evidence is derived locally before read-only scanners run.
- A real P1 run for repository `1303320259` resolved SHA `ffea32e50a6b689f11ec22f2b8aa441b9a359b10`, downloaded and scanned the archive, wrote one immutable report, and retained zero load failures. Its quarantine decision remains private evidence and is not converted into an accusation or external Issue.
- Verification passed: 42 test files and 217 tests, TypeScript no-emit, workflow YAML parsing, and diff whitespace checks.
- Remaining: commit validation-only implementation files, push to main, rerun the complete 592-repository validation, verify a successful `plugin-validation-state`, then manually dispatch `Sync catalog` and inspect the deployed validation markers.

### 2026-08-15 - Post-publication incremental repair

- Run `31823926639` completed 20/20 shards and promotion successfully. Manual sync run `31826452019` restored that state, rebuilt, and deployed the public catalog.
- Live `/catalog.json` shows SHA-bound validation data, including 30 current verified entries after the refreshed 1,000-repository catalog expired or displaced stale records.
- The successful state retained 294 cursor entries from 593 published records because 299 infrastructure-attributed outcomes were deliberately left queued. That conflicts with the requested first-full-then-update-only schedule and would repeat unchanged repositories hourly.
- Of those infrastructure outcomes, 274 are `SCANNER_UNAVAILABLE`; reproduction showed OSV Scanner exits 128 on a repository with no package sources and explicitly supports `--allow-no-lockfiles` for this normal case.
- Repair boundary: parse structured scanner stdout even when a scanner uses a findings exit code; allow OSV repositories with no lockfiles; reconcile older cursors from exact pushedAt/DSH/platform/validator feed records; and advance every completed terminal report without granting verification.
- Exit gate: RED/GREEN tests cover scanner command/result handling and exact-target cursor repair, then a new run selects only genuinely new or updated repositories from the refreshed catalog.

### 2026-08-15 - Incremental repair implementation complete

- RED commit `967fcad` captured OSV no-lockfile handling, structured findings from non-zero scanner exits, infrastructure cursor advancement, and exact-target feed reconciliation.
- OSV Scanner now uses its supported `--allow-no-lockfiles` mode; scanner findings stdout is parsed even when the tool returns a findings exit code. Unstructured scanner failures remain infrastructure-unavailable.
- Every completed terminal report now advances the cursor regardless of outcome attribution. This suppresses hourly reruns without changing failed or inconclusive evidence into a verified result.
- Selection startup reconciles compatible older state from published records only when repository pushedAt, DSH version, platform, validator version, and baseline target remain compatible. A missing or incompatible cursor still forces the required first full run.
- Real artifacts from runs `31823926639` and `31826452019` showed 362 repositories selected without reconciliation versus 121 genuinely new or updated repositories with reconciliation; repaired cursor entries increased from 294 to 513.
- Verification passed: 42 test files and 219 tests, TypeScript no-emit, workflow YAML parsing, and diff whitespace checks.
- Remaining: push validation-only commits and run the 121-repository incremental batch so its successful state becomes the hourly baseline.

### 2026-08-15 - Incremental validation and website synchronization observed

- Incremental validation run `31827248166` selected exactly 121 new or updated repository IDs from a compatible 513-entry cursor. All 20 active shards completed successfully with `max-parallel: 4`, followed by a successful promotion job.
- The resulting `plugin-validation-state` advanced the cursor to 603 entries and retained 664 public evidence records: 246 structure-passed, 418 structure-failed, 37 sandbox-passed, 24 sandbox-failed, and 185 sandbox-inconclusive observations.
- Manual catalog sync run `31828804340` restored the newest successful validation state, passed tests and build, and deployed independently. This confirms validation completion can feed the next catalog refresh without coupling validation health to the 30-minute discovery schedule.
- Public `/catalog.json` was regenerated at `2026-08-14T18:29:03.549Z` with 1,000 repositories and 32 current SHA-bound Verified entries. `bibibala/dsh-git-guard` and `lxj808624/dsh-tool-git` display `已验证`; their install commands are pinned to `4554f987ea066567c43ea4288aa358fefd82390f` and `3bb1443a6291fb6437e52d8b897a1dd48db03a1b` respectively.
- Two sandbox-passed records, `Chhlafiu4312/citeguard` and `Chhlafiu4312/promptwall`, correctly remain `expired` because their validated SHAs do not match the current catalog source binding.
- P0-P4 created no external Issue. The action artifacts retain sanitized evidence for 30 days; durable permanent history remains a separate unresolved storage requirement.

### 2026-08-15 - Structure outcome classification repair started

- Live evidence contains 373 entries labeled `check-failed`, but only 62 are plugin-attributed required-check failures. Another 219 are historical `infrastructure / SCANNER_UNAVAILABLE` outcomes and 92 are `policy / SECURITY_REVIEW_REQUIRED` quarantines.
- Repair boundary: preserve the raw required ladder and failure attribution, but publish infrastructure structure outcomes as `inconclusive` and policy quarantines as a distinct `quarantined` stage with the `security-review` overall marker. Neither may be displayed as a plugin structure failure.
- Scanner evidence must be tool-specific. Trivy vulnerability findings, Trivy secret findings, OSV vulnerabilities, and Gitleaks secrets must not cause another scanner to be labeled dirty or clean incorrectly.
- Add an explicit manual `force_full` workflow input so a validator repair can safely reprocess all eligible repositories without changing DSH, platform, validator, or baseline bindings. Scheduled runs remain incremental and concurrency remains capped at four shards.
- Exit gate: RED/GREEN state, feed, UI, scanner, and workflow tests; full coverage and type/build checks; validation-only push; one successful bounded full revalidation; independent catalog sync; public counts no longer classify infrastructure or policy outcomes as `check-failed`.

### 2026-08-15 - Structure outcome classification implementation complete

- RED commit `2e75718` captured the required distinction between plugin structure failures, infrastructure-inconclusive results, and policy quarantines, plus scanner-specific evidence and the manual full-run workflow contract.
- GREEN commit `392bd73` publishes infrastructure outcomes as `inconclusive`, policy outcomes as `quarantined / security-review`, and reserves `check-failed` for deterministic plugin-attributed structure failures.
- Trivy vulnerability/secret evidence, OSV vulnerabilities, and Gitleaks secret evidence are now evaluated independently, removing contradictory clean findings caused by another scanner.
- Manual `force_full` revalidation ignores the previous cursor only for an explicit workflow dispatch. The hourly schedule remains incremental, and shard concurrency remains bounded at four.
- Local verification passed: 7 focused files and 54 tests; 42 files and 225 tests with 98.63% statements, 89.88% branches, 98.91% functions, and 99.06% lines; TypeScript no-emit; workflow YAML parsing; `git diff --check`; Astro check/build with 1,835 generated pages and zero errors.
- Remaining: push the validation-only commits, complete one bounded full validation run, inspect the resulting state classification, independently sync the catalog, and verify the public catalog/detail markers.

### 2026-08-15 - Validator toolchain registry failure and repair

- Full run `31830948136` selected 610 repositories in explicit `full` mode with 20 shards, then stopped safely before candidate execution because the P2 validator image could not be built.
- The infrastructure failure was an npm publication-order gap: `@aws-sdk/credential-provider-node@3.972.80` referenced then-unavailable `@aws-sdk/credential-provider-ini@^3.973.14`. No plugin was executed or classified by the failed run.
- RED commit `3914afc` requires both P2 and P3 images to install a repository-locked validator toolchain rather than resolving global DSH dependencies at image-build time.
- GREEN commit `369f6e2` adds a complete npm lock for DSH `0.1.0-rc.6` and pnpm `11.19.0`, pins the last complete AWS provider pair, and exposes the local toolchain binaries through `PATH` in both images.
- Local Docker rebuilt the P2 image from the lock with Node 22/npm 10, installing 533 packages with zero reported npm vulnerabilities. Baseline repository `1323526209` then completed the real non-root networkless sandbox and returned the expected `verified` outcome.
- Verification passed: 42 files and 225 tests; 98.63% statements, 89.88% branches, 98.91% functions, and 99.06% lines; TypeScript no-emit; `git diff --check`; real P2 image build; one real pinned canary.
- Remaining: push the toolchain RED/GREEN commits, dispatch another bounded full run, inspect all public-state classifications, independently sync the catalog, and verify the deployed markers.

### 2026-08-15 - Installability-first P1/P2 optimization started

- Full run `31831960740` completed 20/20 bounded shards and promotion successfully. Its 610 current reports contained 124 ordinary structure failures, 123 security quarantines, 363 structure-passed results, and zero `SCANNER_UNAVAILABLE` outcomes.
- The ordinary blockers were 42 invalid or missing DSH patch declarations, 35 missing entrypoints, 38 missing package manifests, 8 missing Skill documents, and 1 collection membership check. These should become advisory evidence and proceed to the owned validator where possible.
- Of the 123 quarantines, 67 contained vulnerability findings without any secret finding. Known dependency vulnerabilities remain recorded security evidence but are no longer treated as malicious-source signals; 56 reports with Trivy or Gitleaks secret findings remain quarantined for human review.
- Of 47 dependency acquisition failures, 43 had no root lockfile and were forced through `npm ci`. The relaxed P2 contract uses script-disabled `npm install` when no supported root lockfile exists, while retaining `npm ci` and frozen pnpm for pinned roots.
- Web and channel/MCP projects without a feature-specific contract may use the generic Linux install, DSH load, entrypoint import, and postflight path. They do not gain Playwright or mock-feature evidence, but may satisfy the requested installability-level verification.
- Bump the validator binding to `0.1.1` so prior `0.1.0` results expire and unchanged repositories re-enter one bounded full validation. Hourly runs remain incremental after that successful state.
- Exit gate: RED/GREEN tests cover every relaxed structure blocker, vulnerability-versus-secret handling, no-lock acquisition, Web/Channel fallback, validator-version synchronization, independent schedules, bounded concurrency, and no Issue/deployment credentials in validation; then pass a real Docker canary, a complete GitHub full run, independent catalog sync, and public marker inspection.

### 2026-08-15 - Installability-first P1/P2 implementation complete locally

- RED commit `882d154` captured 12 expected failures for advisory structure checks, vulnerability warnings, Web/Channel install fallback, no-lock dependency acquisition, and validator `0.1.1` synchronization.
- Missing manifests, entrypoints, DSH patches, Skill documents, and collection members are now advisory evidence. Repository identity/activity/size, scanner availability, external credentials, and Secret findings retain their safety behavior.
- Trivy and OSV dependency vulnerabilities remain visible `security` warnings but no longer imply malicious source or block installation. Trivy/Gitleaks Secret signals remain quarantined and never enter the execution sandbox.
- Web and channel/MCP projects without feature contracts now receive the generic Linux install, DSH load, entrypoint import, and postflight check. This is installability evidence, not Playwright or external-service feature evidence.
- No-lock projects now use the pinned pnpm in the networked acquisition phase with scripts disabled, so the subsequent networkless DSH install consumes the same store. Execution remains non-root, secret-free, constrained, and `network=none`.
- Real pinned sample `Hyperionjust/dsh-tool-underseal@11076603a692718c437c2eb0432e1b2a9a0cc2c5` moved from `DEPENDENCY_INSTALL_FAILED` to `install_passed / runtime_passed / smoke_passed / verified` after the aligned pnpm acquisition fix.
- Real pinned Web sample `heartmove/dsh-side-chat@2d1c6f55124323522cf2e3bd0057f7ba957e16f6` moved from `WEB_SMOKE_CONTRACT_REQUIRED` to the same complete installability ladder and `verified` result.
- Validator binding `0.1.1` makes the successful `0.1.0` state incompatible by design. A local selection using the latest 610-entry catalog/state produced `mode=full`, `firstRun=true`, 610 repositories, and 20 shards; subsequent successful state will restore incremental selection.
- Verification passed: 42 files and 232 tests with 98.63% statements, 89.88% branches, 98.91% functions, and 99.06% lines; TypeScript no-emit; all workflow YAML; `git diff --check`; Astro check/build with 1,835 pages; real P2 image build; two real pinned sandbox candidates.
- Remaining: push the implementation, run the full `0.1.1` workflow with four-way concurrency, inspect the final state, trigger the independent catalog sync, and verify the public catalog/detail markers.

### 2026-08-15 - Catalog-independent canary repair

- Full run `31871667267` selected 646 repositories for validator `0.1.1` and completed the serial canary execution, but the promotion gate stopped before candidate shards with `BASELINE_COVERAGE_INSUFFICIENT`.
- The retained artifact contained 19 reports. Fixed target `Elaina-real/dsh-tiered-approval` was absent from the dynamic catalog snapshot, so the baseline runner emitted `CATALOG_ENTRY_MISSING` instead of validating it. The repository remains public under numeric ID `1333278814`, and pinned SHA `096e3441a0709de1db7a4f72fdef16768ec51df5` still resolves exactly.
- Baseline targets are now operationally independent from catalog membership. A missing catalog entry uses the baseline's fixed identity only to begin resolution; the numeric-ID GitHub lookup still verifies the repository and supplies its current full name before the pinned archive is downloaded.
- RED/GREEN coverage proves a fixed-SHA canary remains runnable without a catalog entry. A real rerun of the missing target in validator `0.1.1` completed `install_passed`, `runtime_passed`, `smoke_passed`, and `verified` in the disposable non-root networkless sandbox.
- Follow-up review found that a shard containing only generic Web or channel/MCP candidates would queue Linux installability checks without first building the Linux validator image. The image requirement now derives from the actual candidate plan, so every queued Linux sandbox has its trusted validator image regardless of display or execution type.
- RED/GREEN coverage proves Web/channel-only queues build the Linux validator while Skill/Collection-only inconclusive queues do not waste an image build.
- Merge verification passed 43 test files and 235 tests with 98.63% statements, 89.88% branches, 98.91% functions, and 99.06% lines; TypeScript no-emit; all workflow YAML; staged credential scan; `git diff --check`; and the 1,835-page Astro check/build.
- Remaining: push the catalog-independent canary repair, rerun the bounded full workflow, inspect the successful validation state, trigger the independent catalog sync, and verify the public SHA-bound markers.
