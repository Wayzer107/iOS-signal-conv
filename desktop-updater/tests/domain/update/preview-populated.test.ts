import { beforeEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { appendCanonicalMessages } from '../../../src/domain/update/sqlite-client';
import { previewAppend } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';

describe('preview append on populated target', () => {
  const dbPath = resolve(process.cwd(), 'tmp', 'preview-populated.sqlite');

  beforeEach(async () => {
    await rm(dbPath, { force: true });
  });

  it('recognizes already persisted rows', async () => {
    // Persist the first fixture message so preview detects it as existing
    await appendCanonicalMessages(dbPath, [fixtureMessages[0]]);

    await expect(previewAppend(dbPath, fixtureMessages)).resolves.toEqual({
      totalInput: fixtureMessages.length,
      newRows: 1,
      skippedExisting: 1,
    });
  });
});
