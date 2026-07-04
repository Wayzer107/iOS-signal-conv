import type { CanonicalMessage } from './types';
import { createArchiveSchemaSql as schemaSql } from './schema';

export function createArchiveSchemaSql(): string[] {
  return schemaSql();
}

function encodeField(value: string): string {
  const v = value ?? '';
  const len = Buffer.from(v, 'utf8').length;
  return `${len}:${v}`;
}

export function computeMessageIdentity(message: CanonicalMessage): string {
  // Length-prefixed UTF-8 fields to avoid collisions from raw delimiters
  const fields = [
    message.conversationKey,
    message.authorKey,
    String(message.timestampMs),
    message.body,
    message.hasAttachments ? '1' : '0',
    message.hasQuote ? '1' : '0',
    message.quoteBody ?? '',
  ];
  return fields.map((f) => encodeField(f)).join('|');
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
    if ((a.body ?? '') !== (b.body ?? '')) return asciiCompare(a.body ?? '', b.body ?? '');
    if (a.hasAttachments !== b.hasAttachments) return (a.hasAttachments ? 1 : 0) - (b.hasAttachments ? 1 : 0);
    if (a.hasQuote !== b.hasQuote) return (a.hasQuote ? 1 : 0) - (b.hasQuote ? 1 : 0);
    return asciiCompare(a.quoteBody ?? '', b.quoteBody ?? '');
  });
}
