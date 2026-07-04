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
