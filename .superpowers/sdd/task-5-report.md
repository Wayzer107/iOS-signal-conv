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

