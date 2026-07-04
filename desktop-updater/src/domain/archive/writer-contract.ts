import type { CanonicalMessage } from './types';
import { createArchiveSchemaSql as schemaSql } from './schema';

export function createArchiveSchemaSql(): string[] {
  return schemaSql();
}

export function computeMessageIdentity(message: CanonicalMessage): string {
  return [
    message.conversationKey,
    message.authorKey,
    String(message.timestampMs),
    message.body,
    message.hasAttachments ? '1' : '0',
    message.hasQuote ? '1' : '0',
    message.quoteBody ?? '',
  ].join('|');
}

export function sortCanonicalMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  return [...messages].sort((a, b) => {
    const c = a.conversationKey.localeCompare(b.conversationKey);
    if (c !== 0) return c;
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    const d = a.authorKey.localeCompare(b.authorKey);
    if (d !== 0) return d;
    if (a.body !== b.body) return a.body.localeCompare(b.body);
    if (a.hasAttachments !== b.hasAttachments) return (a.hasAttachments ? 1 : 0) - (b.hasAttachments ? 1 : 0);
    if (a.hasQuote !== b.hasQuote) return (a.hasQuote ? 1 : 0) - (b.hasQuote ? 1 : 0);
    return (a.quoteBody ?? '').localeCompare(b.quoteBody ?? '');
  });
}
