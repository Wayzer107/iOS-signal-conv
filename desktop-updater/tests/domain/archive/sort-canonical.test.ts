import { describe, it, expect } from 'vitest';
import { sortCanonicalMessages } from '../../../src/domain/archive/writer-contract';

describe('sortCanonicalMessages deterministic ASCII-safe ordering', () => {
  it('sorts by conversationKey (ASCII), then timestampMs, then authorKey (ASCII)', () => {
    const messages = [
      { conversationKey: 'a', authorKey: 'b', timestampMs: 2, body: 'b', hasAttachments: false, hasQuote: false, quoteBody: null },
      { conversationKey: 'A', authorKey: 'a', timestampMs: 1, body: 'a', hasAttachments: false, hasQuote: false, quoteBody: null },
      { conversationKey: 'a', authorKey: 'a', timestampMs: 1, body: 'a', hasAttachments: false, hasQuote: false, quoteBody: null },
    ];

    const sorted = sortCanonicalMessages(messages as any);
    const order = sorted.map((m) => [m.conversationKey, m.timestampMs, m.authorKey]);
    expect(order).toEqual([
      ['A', 1, 'a'], // 'A' sorts before 'a' in ASCII
      ['a', 1, 'a'],
      ['a', 2, 'b'],
    ]);
  });
});
