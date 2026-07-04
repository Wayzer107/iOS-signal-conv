import { beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyAppendUpdate, previewAppend } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';

const dbPath = resolve(process.cwd(), 'tmp', 'empty-target.sqlite');

describe('append preview parity', () => {
  beforeEach(async () => {
    await mkdir(resolve(process.cwd(), 'tmp'), { recursive: true });
    await rm(dbPath, { force: true });
  });

  it('matches empty-target preview counts to applied inserts', async () => {
    const preview = await previewAppend(dbPath, fixtureMessages);
    const applied = await applyAppendUpdate(dbPath, fixtureMessages);

    expect(preview.totalInput).toBe(fixtureMessages.length);
    expect(preview.newRows).toBe(fixtureMessages.length);
    expect(preview.skippedExisting).toBe(0);
    expect(applied.inserted).toBe(preview.newRows);
    expect(applied.skipped).toBe(preview.skippedExisting);
  });
});

