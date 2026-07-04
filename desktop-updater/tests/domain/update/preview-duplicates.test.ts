import { beforeEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { appendCanonicalMessages } from '../../../src/domain/update/sqlite-client';
import { previewAppend } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';

describe('preview append with duplicate input', () => {
  const dbPath = resolve(process.cwd(), 'tmp', 'preview-duplicates.sqlite');

  beforeEach(async () => {
    await rm(dbPath, { force: true });
  });

  it('counts skippedExisting only for rows already persisted, not for intra-batch duplicates', async () => {
    // Persist the first fixture message so preview should report it as existing
    await appendCanonicalMessages(dbPath, [fixtureMessages[0]]);

    const input = [fixtureMessages[0], fixtureMessages[0], fixtureMessages[1]];

    await expect(previewAppend(dbPath, input)).resolves.toEqual({
      totalInput: input.length,
      newRows: 1, // only fixtureMessages[1] is new
      skippedExisting: 1, // only fixtureMessages[0] already exists in DB
    });
  });
});
