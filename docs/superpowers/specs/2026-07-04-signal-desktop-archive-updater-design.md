# Signal Desktop Archive Updater Design

## Goal

Build a new cross-platform desktop app (Linux, macOS, Windows) that updates an iOS-compatible Signal archive SQLite database by appending new data from Signal Desktop local data. The app must preserve existing rows and only append new rows. For empty targets, output must match the semantics of `/Users/jamie/Documents/signalparser/preprocess/signal_to_sqlite.py`.

## Scope

1. New standalone desktop app (from scratch), with prior projects used as reference only.
2. Primary input source: Signal Desktop local database/profile data.
3. Output/update target: iOS archive SQLite schema used by existing iOS viewer stack.
4. Incremental behavior: append-only updates, idempotent on repeated runs.

Out of scope for v1: cloud sync, remote services, or replacing existing archive rows.

## Architecture

The system is split into four isolated modules:

1. **Signal source reader**
   - Detects Signal Desktop profile paths per OS.
   - Reads local database/data in read-only mode.
   - Resolves/decrypts required keys using OS-specific mechanisms.

2. **Canonical normalizer**
   - Converts source records into a stable intermediate message model.
   - Applies deterministic normalization for fields that influence output rows.
   - Maintains consistent conversation and participant mapping.

3. **SQLite updater/writer**
   - Opens existing target archive or initializes a new one with the required schema.
   - Computes append candidates and inserts only unseen messages.
   - Preserves prior rows untouched.
   - Enforces deterministic insert ordering.

4. **Desktop GUI workflow**
   - Guides users through source discovery, target selection, preview, update, and save.
   - Shows append counts and expected changes before write.
   - Surfaces actionable failures without silent fallback.

## Data Contract and Compatibility

The target SQLite format is treated as a strict contract:

1. Schema and value semantics must match the archive format consumed by the iOS app.
2. Mapping behavior is validated against existing logic in `signal-archive-updater` and `signal_to_sqlite.py`.
3. For fixture datasets processed into an empty database, produced rows must match expected canonical output semantics used by `signal_to_sqlite.py`.

## Incremental Update Model

Update behavior is append-only:

1. Existing rows are never modified or deleted.
2. Newness detection uses a deterministic identity derived from normalized, stable fields (conversation identity, sender identity, timestamp, body, and normalized message flags).
3. Re-running updates with the same source data produces zero additional inserts.
4. Ordering is stable so outputs are deterministic and reproducible.

## Error Handling

The app fails explicitly with user-actionable messages for:

1. Missing/unsupported Signal Desktop data layout.
2. Key retrieval/decryption failure.
3. Locked or unreadable source/target database.
4. Target schema mismatch.
5. Data mapping constraint violations.

No broad catch-all recovery that silently skips data.

## Testing Strategy

v1 acceptance requires both deterministic correctness and real workflow coverage:

1. **Deterministic fixture parity tests**
   - Given fixed datasets, empty-target output matches canonical expected SQLite content derived from `signal_to_sqlite.py`.

2. **Append idempotency tests**
   - First run appends expected new rows.
   - Second run with unchanged source appends zero rows.

3. **Cross-platform source-discovery tests**
   - Linux/macOS/Windows profile/key-path discovery logic verified with platform fixtures/mocks.

4. **End-to-end GUI test**
   - User flow: pick source profile -> pick target DB -> preview -> update -> save.
   - Verifies final DB state and surfaced success/error states.

## Delivery Milestones

1. App skeleton + module boundaries.
2. Source reader and canonical normalizer.
3. SQLite append/update engine.
4. GUI workflow and preview.
5. Deterministic parity + idempotency + E2E test completion.

## Success Criteria

1. Desktop app runs on Linux, macOS, and Windows.
2. Uses Signal Desktop local data as primary input.
3. Updates existing archive DB by appending only new data.
4. Deterministic fixture tests pass.
5. End-to-end GUI update flow passes.
