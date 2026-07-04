import { beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyAppendUpdate } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';

const dbPath = resolve(process.cwd(), 'tmp', 'idempotent.sqlite');

describe('append update', () => {
  beforeEach(async () => {
    await mkdir(resolve(process.cwd(), 'tmp'), { recursive: true });
    await rm(dbPath, { force: true });
  });

  it('inserts once and skips on second run', async () => {
    const first = await applyAppendUpdate(dbPath, fixtureMessages);
    const second = await applyAppendUpdate(dbPath, fixtureMessages);
    expect(first.inserted).toBeGreaterThan(0);
    expect(second.inserted).toBe(0);
  });
});

