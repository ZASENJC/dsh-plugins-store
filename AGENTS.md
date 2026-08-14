# DSH Plugin Store Agent Instructions

## Validation Governance

- Read and update `VALIDATION_PLAN.md` before and after every validation implementation run.
- Preserve validation history. A failed or expired plugin remains visible in the catalog.
- A current `verified` result must be bound to the exact GitHub numeric repository ID, source SHA, DSH version, platform, and validator version.
- A source SHA change or target DSH version change expires the current result and queues revalidation; it must not erase historical evidence.
- External Verified README entries are historical inputs only. They cannot directly grant the store's current `verified` status.
- Keep display category and execution type separate. Execution type chooses the validator and must be one of `host-tool`, `web`, `command`, `channel-mcp`, `native`, `skill`, `collection`, or `non-plugin`.

## Required Ladder

Record each layer independently:

1. Discovery: `discovered`.
2. Classification: `recognized` or `unrecognized`.
3. Structure: `structure_passed` or `structure_failed`.
4. Sandbox: `queued`, `running`, or `inconclusive`.
5. Installation: `install_passed` or `install_failed`.
6. Runtime: `runtime_passed` or `runtime_failed`.
7. Functional smoke: `smoke_passed` or `smoke_failed`.
8. Final: `verified`, `failed`, or `expired`.

## Structure Check Boundary

- Structure checks must not execute third-party source code or package lifecycle scripts.
- Check repository identity/state, pinned SHA, package entrypoints and exports, DSH bundle/client metadata, patch paths, build artifacts, prepare requirements, platform/profile/credential declarations, lockfiles, license, size, submodules, LFS, vulnerabilities, secret findings, and DSH-specific manifest traps.
- Suspected malicious behavior is quarantined for human review. Do not publish an accusation or open a security Issue automatically.

## Sandbox Boundary

- Never run validation on a production server or in the user's normal DSH profile.
- Pin repository ID, source SHA, DSH version, platform, and validator version before scheduling.
- Separate download from execution. Download fixed inputs first with lifecycle scripts disabled.
- Execution must be ephemeral, non-root, secret-free, without host directories or Docker socket, and constrained by CPU, memory, PID, and time limits.
- After the test, check orphan processes, listening ports, writes outside the validation profile, and profile residue. Destroy the environment and retain only sanitized reports and logs.
- Linux Docker is the initial platform. Do not present Linux results as Windows or macOS evidence.

## Failure And Issue Policy

- Attribute failures as `plugin`, `compatibility`, `infrastructure`, `policy`, or `inconclusive`.
- P0-P4 must never create external Issues. Issue automation belongs to P5 and must remain opt-in.
- P5 may create an Issue only for reproducible `plugin` or explicit `compatibility` failures seen in two fresh sandboxes with the same fingerprint.
- Sandbox credentials must never include the GitHub App token. Issue deduplication key is repository + SHA + DSH version + failure code.

## Rollout Gates

- P1 is shadow mode: generate reports only, with no public status mutation and no Issues.
- P2 establishes an approximately 20-project Linux headless/tool baseline.
- P3 adds DSH Web with Playwright plus collection and channel/MCP validators.
- P4 promotes results only after the baseline quality gate passes; verified install references must be pinned to the validated SHA.
- P5 is out of scope until explicitly authorized: opt-in Issue automation and Windows/macOS validation.

## Engineering Practice

- Use tests to define every state transition, safety boundary, promotion gate, and command plan before implementation.
- Prefer deterministic fixtures and dry-run command plans in tests. A test must never execute untrusted third-party code or create an external Issue.
- Preserve unrelated worktree changes and the existing one-click installation behavior.
