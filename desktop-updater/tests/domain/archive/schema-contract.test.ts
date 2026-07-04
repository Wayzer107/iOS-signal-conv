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
