import { beforeEach, describe, expect, it } from 'vitest';
import { access, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { previewAppend } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';

describe('preview append', () => {
  const dbPath = resolve(process.cwd(), 'tmp', 'preview-readonly.sqlite');

  beforeEach(async () => {
    await rm(dbPath, { force: true });
    await rm(resolve(process.cwd(), 'tmp'), { recursive: true, force: true });
  });

  it('does not create the target db or schema tables', async () => {
    await expect(previewAppend(dbPath, fixtureMessages)).resolves.toEqual({
      totalInput: fixtureMessages.length,
      newRows: fixtureMessages.length,
      skippedExisting: 0,
    });

    await expect(access(dbPath, constants.F_OK)).rejects.toBeTruthy();
  });
});
