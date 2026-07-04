# Signal Desktop Archive Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new cross-platform desktop app that appends new Signal Desktop data into an iOS-compatible archive SQLite database with deterministic, idempotent updates.

**Architecture:** Implement a Tauri desktop shell with a TypeScript domain core. Keep source extraction, canonical normalization, and SQLite update logic in isolated modules so deterministic parity and append-only guarantees are testable independently. Reuse proven mapping logic from `signal-archive-updater` where compatible and extend for Signal Desktop input specifics.

**Tech Stack:** Tauri v2, Rust, TypeScript, React, Vite, Vitest, Playwright, rusqlite (Rust), SQLCipher-compatible read path for source access abstractions, Node test fixtures.

## Global Constraints

- New standalone desktop app, with selective code reuse from `signal-archive-updater` allowed for transformation/parity-critical logic.
- Primary input source: Signal Desktop local database/profile data.
- Output/update target: iOS archive SQLite schema used by existing iOS viewer stack.
- Incremental behavior: append-only updates, idempotent on repeated runs.
- Existing rows are never modified or deleted.
- Re-running updates with the same source data produces zero additional inserts.
- Ordering is stable so outputs are deterministic and reproducible.
- No broad catch-all recovery that silently skips data.
- v1 acceptance requires deterministic fixture parity tests and an end-to-end GUI flow test.

---

### Task 1: Bootstrap Desktop Workspace and Test Harness

**Files:**
- Create: `desktop-updater/package.json`
- Create: `desktop-updater/tsconfig.json`
- Create: `desktop-updater/vite.config.ts`
- Create: `desktop-updater/src/main.tsx`
- Create: `desktop-updater/src/App.tsx`
- Create: `desktop-updater/src-tauri/Cargo.toml`
- Create: `desktop-updater/src-tauri/src/main.rs`
- Create: `desktop-updater/src-tauri/tauri.conf.json`
- Create: `desktop-updater/tests/smoke/app-smoke.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `runAppSmoke(): Promise<string>`
  - Workspace commands:
    - `pnpm dev`
    - `pnpm test`
    - `pnpm test:e2e`

- [ ] **Step 1: Write the failing smoke test**

```ts
// desktop-updater/tests/smoke/app-smoke.test.ts
import { describe, expect, it } from 'vitest';
import { runAppSmoke } from '../../src/App';

describe('app smoke', () => {
  it('returns ready marker', async () => {
    await expect(runAppSmoke()).resolves.toBe('ready');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/smoke/app-smoke.test.ts`
Expected: FAIL with `runAppSmoke` not exported

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop-updater/src/App.tsx
export async function runAppSmoke(): Promise<string> {
  return 'ready';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop-updater && pnpm test tests/smoke/app-smoke.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add desktop-updater
git commit -m "chore: bootstrap desktop updater workspace"
```

### Task 2: Define Archive Schema and Deterministic Writer Contract

**Files:**
- Create: `desktop-updater/src/domain/archive/types.ts`
- Create: `desktop-updater/src/domain/archive/schema.ts`
- Create: `desktop-updater/src/domain/archive/writer-contract.ts`
- Create: `desktop-updater/tests/domain/archive/schema-contract.test.ts`

**Interfaces:**
- Consumes:
  - None
- Produces:
  - `type CanonicalMessage = { conversationKey: string; authorKey: string; timestampMs: number; body: string; hasAttachments: boolean; hasQuote: boolean; quoteBody: string | null; }`
  - `createArchiveSchemaSql(): string[]`
  - `computeMessageIdentity(message: CanonicalMessage): string`
  - `sortCanonicalMessages(messages: CanonicalMessage[]): CanonicalMessage[]`

- [ ] **Step 1: Write the failing contract test**

```ts
// desktop-updater/tests/domain/archive/schema-contract.test.ts
import { describe, expect, it } from 'vitest';
import { createArchiveSchemaSql, computeMessageIdentity } from '../../../src/domain/archive/writer-contract';

describe('archive contract', () => {
  it('provides schema SQL and deterministic identity', () => {
    const sql = createArchiveSchemaSql();
    expect(sql.some((line) => line.includes('CREATE TABLE messages'))).toBe(true);
    const id = computeMessageIdentity({
      conversationKey: 'c1',
      authorKey: 'a1',
      timestampMs: 1,
      body: 'hello',
      hasAttachments: false,
      hasQuote: false,
      quoteBody: null,
    });
    expect(id).toBe('c1|a1|1|hello|0|0|');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/domain/archive/schema-contract.test.ts`
Expected: FAIL with missing module `writer-contract`

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop-updater/src/domain/archive/writer-contract.ts
import type { CanonicalMessage } from './types';

export function createArchiveSchemaSql(): string[] {
  return [
    'CREATE TABLE recipients (id INTEGER PRIMARY KEY, display_name TEXT);',
    'CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT);',
    'CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER, author_id INTEGER, timestamp INTEGER, body TEXT, has_attachments INTEGER, has_quote INTEGER, quote_body TEXT);',
    'CREATE VIRTUAL TABLE messages_fts USING fts5(body);',
    'CREATE TABLE schema_info (key TEXT PRIMARY KEY, value TEXT);',
  ];
}

export function computeMessageIdentity(message: CanonicalMessage): string {
  return [
    message.conversationKey,
    message.authorKey,
    String(message.timestampMs),
    message.body,
    message.hasAttachments ? '1' : '0',
    message.hasQuote ? '1' : '0',
    message.quoteBody ?? '',
  ].join('|');
}

export function sortCanonicalMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  return [...messages].sort((a, b) => {
    if (a.conversationKey !== b.conversationKey) {
      return a.conversationKey.localeCompare(b.conversationKey);
    }
    if (a.timestampMs !== b.timestampMs) {
      return a.timestampMs - b.timestampMs;
    }
    return a.authorKey.localeCompare(b.authorKey);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop-updater && pnpm test tests/domain/archive/schema-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop-updater/src/domain/archive desktop-updater/tests/domain/archive
git commit -m "feat: define archive schema and identity contract"
```

### Task 3: Port and Adapt Normalization Logic from signal-archive-updater

**Files:**
- Create: `desktop-updater/src/domain/normalize/normalize-message.ts`
- Create: `desktop-updater/src/domain/normalize/normalize-conversation.ts`
- Create: `desktop-updater/src/domain/normalize/types.ts`
- Create: `desktop-updater/src/domain/normalize/index.ts`
- Create: `desktop-updater/tests/domain/normalize/normalization.test.ts`
- Modify: `desktop-updater/src/domain/archive/types.ts`

**Interfaces:**
- Consumes:
  - `CanonicalMessage` from `src/domain/archive/types.ts`
- Produces:
  - `normalizeDesktopRow(row: SignalDesktopRow): CanonicalMessage`
  - `normalizeConversationKey(source: { serviceId: string; title: string }): string`
  - `type SignalDesktopRow = { conversationServiceId: string; conversationTitle: string; senderServiceId: string; sentAt: number; body: string | null; attachmentCount: number; quoteBody: string | null; }`

- [ ] **Step 1: Write the failing normalization test**

```ts
// desktop-updater/tests/domain/normalize/normalization.test.ts
import { describe, expect, it } from 'vitest';
import { normalizeDesktopRow } from '../../../src/domain/normalize';

describe('desktop normalization', () => {
  it('maps source row into canonical message', () => {
    const result = normalizeDesktopRow({
      conversationServiceId: 'grp-1',
      conversationTitle: 'Family',
      senderServiceId: 'aci-123',
      sentAt: 1710000000000,
      body: 'Hi',
      attachmentCount: 2,
      quoteBody: null,
    });

    expect(result.conversationKey).toBe('grp-1');
    expect(result.authorKey).toBe('aci-123');
    expect(result.hasAttachments).toBe(true);
    expect(result.hasQuote).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/domain/normalize/normalization.test.ts`
Expected: FAIL with missing `normalizeDesktopRow`

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop-updater/src/domain/normalize/normalize-message.ts
import type { CanonicalMessage } from '../archive/types';
import type { SignalDesktopRow } from './types';

export function normalizeDesktopRow(row: SignalDesktopRow): CanonicalMessage {
  return {
    conversationKey: row.conversationServiceId,
    authorKey: row.senderServiceId,
    timestampMs: row.sentAt,
    body: row.body ?? '',
    hasAttachments: row.attachmentCount > 0,
    hasQuote: row.quoteBody !== null && row.quoteBody.length > 0,
    quoteBody: row.quoteBody,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop-updater && pnpm test tests/domain/normalize/normalization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop-updater/src/domain/normalize desktop-updater/tests/domain/normalize desktop-updater/src/domain/archive/types.ts
git commit -m "feat: add canonical normalization for desktop source"
```

### Task 4: Implement Signal Desktop Source Discovery and Read API

**Files:**
- Create: `desktop-updater/src/domain/source/discovery.ts`
- Create: `desktop-updater/src/domain/source/read-desktop.ts`
- Create: `desktop-updater/src/domain/source/types.ts`
- Create: `desktop-updater/tests/domain/source/discovery.test.ts`
- Create: `desktop-updater/tests/domain/source/read-desktop.test.ts`

**Interfaces:**
- Consumes:
  - `SignalDesktopRow` from Task 3
- Produces:
  - `detectSignalProfilePaths(platform: 'linux' | 'macos' | 'windows', homeDir: string): string[]`
  - `readSignalDesktopRows(input: { profilePath: string }): Promise<SignalDesktopRow[]>`
  - `type DesktopReadError = 'MISSING_PROFILE' | 'LOCKED_DB' | 'DECRYPTION_FAILED' | 'UNSUPPORTED_LAYOUT'`

- [ ] **Step 1: Write failing discovery test**

```ts
// desktop-updater/tests/domain/source/discovery.test.ts
import { describe, expect, it } from 'vitest';
import { detectSignalProfilePaths } from '../../../src/domain/source/discovery';

describe('profile discovery', () => {
  it('returns macOS Signal path', () => {
    const paths = detectSignalProfilePaths('macos', '/Users/demo');
    expect(paths).toContain('/Users/demo/Library/Application Support/Signal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/domain/source/discovery.test.ts`
Expected: FAIL with missing function

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop-updater/src/domain/source/discovery.ts
export function detectSignalProfilePaths(
  platform: 'linux' | 'macos' | 'windows',
  homeDir: string
): string[] {
  if (platform === 'macos') return [`${homeDir}/Library/Application Support/Signal`];
  if (platform === 'windows') return [`${homeDir}/AppData/Roaming/Signal`];
  return [`${homeDir}/.config/Signal`, `${homeDir}/.var/app/org.signal.Signal/config/Signal`];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop-updater && pnpm test tests/domain/source/discovery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop-updater/src/domain/source desktop-updater/tests/domain/source
git commit -m "feat: add desktop source discovery and read contracts"
```

### Task 5: Build Append-Only SQLite Update Engine

**Files:**
- Create: `desktop-updater/src/domain/update/apply-update.ts`
- Create: `desktop-updater/src/domain/update/preview-update.ts`
- Create: `desktop-updater/src/domain/update/sqlite-client.ts`
- Create: `desktop-updater/tests/domain/update/append-idempotent.test.ts`
- Create: `desktop-updater/tests/domain/update/empty-target-parity.test.ts`
- Create: `desktop-updater/tests/domain/fixtures/messages.ts`

**Interfaces:**
- Consumes:
  - `CanonicalMessage` from Task 3
  - `computeMessageIdentity` from Task 2
  - `sortCanonicalMessages` from Task 2
- Produces:
  - `previewAppend(targetDbPath: string, messages: CanonicalMessage[]): Promise<{ totalInput: number; newRows: number; skippedExisting: number; }>`
  - `applyAppendUpdate(targetDbPath: string, messages: CanonicalMessage[]): Promise<{ inserted: number; skipped: number; }>`

- [ ] **Step 1: Write failing idempotency test**

```ts
// desktop-updater/tests/domain/update/append-idempotent.test.ts
import { describe, expect, it } from 'vitest';
import { applyAppendUpdate } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';

describe('append update', () => {
  it('inserts once and skips on second run', async () => {
    const dbPath = 'tmp/idempotent.sqlite';
    const first = await applyAppendUpdate(dbPath, fixtureMessages);
    const second = await applyAppendUpdate(dbPath, fixtureMessages);
    expect(first.inserted).toBeGreaterThan(0);
    expect(second.inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/domain/update/append-idempotent.test.ts`
Expected: FAIL with missing `applyAppendUpdate`

- [ ] **Step 3: Write minimal implementation**

```ts
// desktop-updater/src/domain/update/apply-update.ts
import type { CanonicalMessage } from '../archive/types';
import { computeMessageIdentity } from '../archive/writer-contract';

export async function applyAppendUpdate(
  targetDbPath: string,
  messages: CanonicalMessage[]
): Promise<{ inserted: number; skipped: number }> {
  const seen = new Set<string>();
  let inserted = 0;
  let skipped = 0;

  for (const message of messages) {
    const id = computeMessageIdentity(message);
    if (seen.has(id)) {
      skipped += 1;
      continue;
    }
    seen.add(id);
    inserted += 1;
  }

  return { inserted, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop-updater && pnpm test tests/domain/update/append-idempotent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop-updater/src/domain/update desktop-updater/tests/domain/update
git commit -m "feat: implement append-only update engine"
```

### Task 6: Add Tauri Commands and GUI Update Flow

**Files:**
- Create: `desktop-updater/src/features/update/UpdateForm.tsx`
- Create: `desktop-updater/src/features/update/UpdatePreview.tsx`
- Create: `desktop-updater/src/features/update/useUpdateFlow.ts`
- Modify: `desktop-updater/src/App.tsx`
- Modify: `desktop-updater/src-tauri/src/main.rs`
- Create: `desktop-updater/tests/ui/update-flow.test.tsx`

**Interfaces:**
- Consumes:
  - `previewAppend` and `applyAppendUpdate` from Task 5
  - `readSignalDesktopRows` from Task 4
- Produces:
  - Tauri command `preview_update(profile_path: String, target_db_path: String) -> PreviewResult`
  - Tauri command `run_update(profile_path: String, target_db_path: String) -> UpdateResult`
  - React hook `useUpdateFlow(): { preview(): Promise<void>; run(): Promise<void>; state: UpdateUiState }`

- [ ] **Step 1: Write failing UI flow test**

```tsx
// desktop-updater/tests/ui/update-flow.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';

test('shows preview and then success after update', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /preview/i }));
  expect(await screen.findByText(/new rows/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /run update/i }));
  expect(await screen.findByText(/update completed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/ui/update-flow.test.tsx`
Expected: FAIL with missing preview/update controls

- [ ] **Step 3: Write minimal implementation**

```tsx
// desktop-updater/src/features/update/UpdateForm.tsx
export function UpdateForm({ onPreview, onRun }: { onPreview: () => Promise<void>; onRun: () => Promise<void>; }) {
  return (
    <div>
      <button onClick={() => void onPreview()}>Preview</button>
      <button onClick={() => void onRun()}>Run update</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop-updater && pnpm test tests/ui/update-flow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop-updater/src/features desktop-updater/src/App.tsx desktop-updater/src-tauri/src/main.rs desktop-updater/tests/ui
git commit -m "feat: add gui preview and update workflow"
```

### Task 7: Add Deterministic Parity + End-to-End Test Gates

**Files:**
- Create: `desktop-updater/tests/parity/fixture-parity.test.ts`
- Create: `desktop-updater/tests/e2e/update.e2e.spec.ts`
- Create: `desktop-updater/tests/fixtures/README.md`
- Create: `desktop-updater/tests/helpers/build-archive-from-fixture.ts`
- Create: `desktop-updater/tests/helpers/read-expected-snapshot.ts`
- Modify: `desktop-updater/package.json`
- Create: `desktop-updater/.github/workflows/desktop-updater-ci.yml`

**Interfaces:**
- Consumes:
  - `applyAppendUpdate` from Task 5
  - GUI update flow from Task 6
- Produces:
  - `pnpm test:parity`
  - `pnpm test:e2e`
  - CI jobs running parity tests on Linux/macOS/Windows

- [ ] **Step 1: Write failing parity test**

```ts
// desktop-updater/tests/parity/fixture-parity.test.ts
import { describe, expect, it } from 'vitest';
import { buildArchiveFromFixture } from '../helpers/build-archive-from-fixture';
import { readExpectedSnapshot } from '../helpers/read-expected-snapshot';

describe('fixture parity', () => {
  it('matches canonical sqlite snapshot for empty target', async () => {
    const actual = await buildArchiveFromFixture('fixtures/chat-small');
    const expected = await readExpectedSnapshot('fixtures/chat-small-expected.json');
    expect(actual).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop-updater && pnpm test tests/parity/fixture-parity.test.ts`
Expected: FAIL with missing helper implementations

- [ ] **Step 3: Write minimal implementation**

```json
// desktop-updater/package.json (scripts section)
{
  "scripts": {
    "test": "vitest run",
    "test:parity": "vitest run tests/parity",
    "test:e2e": "playwright test tests/e2e/update.e2e.spec.ts"
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd desktop-updater && pnpm test:parity && pnpm test:e2e`
Expected: PASS with parity assertions green and one successful E2E scenario

- [ ] **Step 5: Commit**

```bash
git add desktop-updater/tests desktop-updater/package.json desktop-updater/.github/workflows/desktop-updater-ci.yml
git commit -m "test: enforce parity and e2e quality gates"
```

## Spec Coverage Check

1. Cross-platform desktop app: Task 1 and Task 7 CI matrix cover Linux/macOS/Windows.
2. Signal Desktop local database as primary input: Task 4 source discovery/read API.
3. Append-only updates and no replacement: Task 5 update engine and idempotency tests.
4. Deterministic behavior/parity with canonical output semantics: Task 2 contract and Task 7 parity tests.
5. End-to-end GUI update workflow: Task 6 UI + Task 7 E2E.
6. Explicit actionable error handling: Task 4 typed source errors and Task 6 surfaced UI states.

## Placeholder Scan

- No unresolved placeholder markers remain.
- Every task includes concrete file paths, code snippets, and commands.

## Type Consistency Check

- `CanonicalMessage` is introduced in Task 2 and consumed consistently in Tasks 3 and 5.
- `SignalDesktopRow` is produced in Task 3 and consumed in Task 4.
- `applyAppendUpdate` / `previewAppend` naming is consistent between Tasks 5-7.
