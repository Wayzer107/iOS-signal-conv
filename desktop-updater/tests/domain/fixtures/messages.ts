import type { CanonicalMessage } from '../../../src/domain/archive/types';

export const fixtureMessages: CanonicalMessage[] = [
  {
    conversationKey: 'grp-1',
    authorKey: 'aci-123',
    timestampMs: 1710000000000,
    body: 'Hi',
    hasAttachments: false,
    hasQuote: false,
    quoteBody: null,
  },
  {
    conversationKey: 'grp-1',
    authorKey: 'aci-124',
    timestampMs: 1710000001000,
    body: 'Hello back',
    hasAttachments: true,
    hasQuote: false,
    quoteBody: null,
  },
];

