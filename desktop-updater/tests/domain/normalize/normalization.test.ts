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

  it('falls back to title when service id empty', () => {
    const result = normalizeDesktopRow({
      conversationServiceId: '',
      conversationTitle: 'Fallback Title',
      senderServiceId: 'aci-456',
      sentAt: 1710000001000,
      body: '',
      attachmentCount: 0,
      quoteBody: null,
    });

    expect(result.conversationKey).toBe('Fallback Title');
    expect(result.authorKey).toBe('aci-456');
  });
});
