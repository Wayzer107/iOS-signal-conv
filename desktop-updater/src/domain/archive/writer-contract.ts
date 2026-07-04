import type { CanonicalMessage } from './types';
import { createArchiveSchemaSql as schemaSql } from './schema';

export function createArchiveSchemaSql(): string[] {
  return schemaSql();
}

export function computeMessageIdentity(message: CanonicalMessage): string {
  // Plain pipe-joined fields as specified by the brief, with a trailing pipe
  const fields = [
    message.conversationKey,
    message.authorKey,
    String(message.timestampMs),
    message.body,
    message.hasAttachments ? '1' : '0',
    message.hasQuote ? '1' : '0',
    message.quoteBody ?? '',
  ];
  return fields.join('|');
}

function asciiCompare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function sortCanonicalMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  return [...messages].sort((a, b) => {
    const c = asciiCompare(a.conversationKey ?? '', b.conversationKey ?? '');
    if (c !== 0) return c;
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    const d = asciiCompare(a.authorKey ?? '', b.authorKey ?? '');
    if (d !== 0) return d;
    // Do NOT apply extra tie-breakers beyond conversationKey, timestampMs, authorKey per brief
    return 0;
  });
}
