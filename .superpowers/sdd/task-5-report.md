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
- SQLite access is handled through the local `sqlite3` CLI.

### Verification
- Full `desktop-updater` Vitest suite passes.

### Notes
- This task intentionally stops at append-only message logic.
- Conversation and recipient maintenance are deferred to later tasks.

### Reviewer fixes
- `previewAppend` is now read-only: it only checks for an existing database and never creates schema or files.
- Removed the ambient `sqlite3` CLI dependency by switching SQLite access to Node's built-in `node:sqlite` API.
- `appendIdentities` now creates the parent output directory before opening a writable database.

### Verification
- `corepack pnpm test tests/domain/update/preview-readonly.test.ts tests/domain/update/append-idempotent.test.ts tests/domain/update/empty-target-parity.test.ts`
- `corepack pnpm test`
