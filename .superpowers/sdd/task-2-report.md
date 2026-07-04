Task 2: Define Archive Schema and Deterministic Writer Contract

Summary
- Implemented CanonicalMessage type, schema SQL, deterministic identity, and sorting contract.
- Files added:
  - src/domain/archive/types.ts
  - src/domain/archive/schema.ts
  - src/domain/archive/writer-contract.ts
  - tests/domain/archive/schema-contract.test.ts

What I changed
- createArchiveSchemaSql returns the exact CREATE statements required by the brief.
- computeMessageIdentity builds a '|' delimited identity using conversationKey, authorKey, timestampMs, body, hasAttachments (0/1), hasQuote (0/1), quoteBody (empty when null).
- sortCanonicalMessages provides a stable, deterministic ordering across conversationKey, timestampMs, authorKey, body, attachments, quote, quoteBody.

Tests
- Ran pnpm install (approved esbuild build) and executed the provided vitest contract test which passes: 1 test, 1 passed.

Notes / Constraints
- I preserved immutability in sorting (returns new array) and deterministic stringification for identity.
- This implements only Task 2 deliverables; Task 1 was assumed complete.

Commit
- 6dbc70b feat: define archive schema and identity contract

Report generated at .superpowers/sdd/task-2-report.md

Fixes applied:
1) computeMessageIdentity: replaced raw '|' joins with length-prefixed UTF-8 fields (format: <len>:<value> joined by '|') to eliminate delimiter-collision risk while preserving string output.
2) sortCanonicalMessages: removed localeCompare usage and implemented deterministic ASCII-safe comparisons for string fields.
3) Added tests: tests/domain/archive/sort-canonical.test.ts ensures deterministic ASCII ordering behavior.

Tests run (command):
PATH=/usr/local/bin:$PATH cd desktop-updater && pnpm test --reporter dot

Test output summary:
Test Files  3 passed (3)
Tests  3 passed (3)
Duration  847ms


Command: PATH=/usr/local/bin:/usr/local/bin:/Users/jamie/Library/Caches/copilot-desktop-gh-2.95.0:/usr/bin:/bin:/usr/sbin:/sbin && cd desktop-updater && pnpm test --reporter dot

Test output:

 RUN  v1.6.1 /Users/jamie/Sources/copilot-worktrees/iOS-signal-conv/wayzer107-reimagined-potato/desktop-updater

 ✓ tests/smoke/app-smoke.test.ts  (1 test) 3ms
 ✓ tests/domain/archive/sort-canonical.test.ts  (1 test) 11ms
 ✓ tests/domain/archive/schema-contract.test.ts  (1 test) 9ms

 Test Files  3 passed (3)
      Tests  3 passed (3)
   Start at  03:03:13
   Duration  1.28s (transform 104ms, setup 0ms, collect 247ms, tests 23ms, environment 1ms, prepare 659ms)

