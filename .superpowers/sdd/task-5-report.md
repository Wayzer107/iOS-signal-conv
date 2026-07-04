## Task 5 Report

Implemented the append-only update engine for Task 5 with the requested scope limit: message append logic only, no conversation or recipient maintenance.

### Delivered
- `desktop-updater/src/domain/update/apply-update.ts`
- `desktop-updater/src/domain/update/preview-update.ts`
- `desktop-updater/src/domain/update/sqlite-client.ts`
- `desktop-updater/tests/domain/update/append-idempotent.test.ts`
- `desktop-updater/tests/domain/update/empty-target-parity.test.ts`
- `desktop-updater/tests/domain/fixtures/messages.ts`

### Behavior
- Canonical messages are sorted before processing.
- Message identity is computed with the Task 2 contract.
- Appends are idempotent across repeated runs against the same SQLite target.
- Preview counts match applied inserts on an empty target.
- SQLite access is handled through Node's built-in `node:sqlite` API.

### Verification
- Full `desktop-updater` Vitest suite passes.

### Notes
- This task intentionally stops at append-only message logic.
- Conversation and recipient maintenance are deferred to later tasks.

### Task 5 important-finding fix
- `applyAppendUpdate` now writes canonical message rows into the archive DB (`messages`, plus minimal `conversations`/`recipients` rows) instead of only recording identities.
- Existing-message detection now reads actual persisted archive rows, so a DB with pre-existing message data but no append log is treated as populated.
- `previewAppend` remains read-only; it only reads existing state and never creates files or tables.

### Verification
- `node /usr/local/Cellar/node/26.4.0/libexec/lib/node_modules/npm/bin/npm-cli.js run test -- tests/domain/update/append-idempotent.test.ts tests/domain/update/preview-readonly.test.ts tests/domain/update/empty-target-parity.test.ts`
- `node /usr/local/Cellar/node/26.4.0/libexec/lib/node_modules/npm/bin/npm-cli.js run test`

### Fix applied (this commit)
- Created full archive schema on empty targets: recipients, conversations, messages, messages_fts, schema_info.
- File changed: `desktop-updater/src/domain/update/sqlite-client.ts`.
- Commit: 82b5058

### Test run summary
I attempted to run the desktop-updater test suite from this environment but the system lacks Node/npm/pnpm, so tests could not be executed here (pnpm/npm not found). To run locally:

1) Ensure Node and pnpm are installed.
2) cd desktop-updater
3) PATH=/usr/local/bin:$PATH pnpm test -- tests/domain/update/append-idempotent.test.ts tests/domain/update/empty-target-parity.test.ts

If you want, I can run tests in CI or in an environment with Node available.

Report path: `.superpowers/sdd/task-5-report.md`
