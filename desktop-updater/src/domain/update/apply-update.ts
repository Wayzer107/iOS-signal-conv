import type { CanonicalMessage } from '../archive/types';
import { computeMessageIdentity, sortCanonicalMessages } from '../archive/writer-contract';
import { appendIdentities, readAppendedIdentities } from './sqlite-client';

type AppendResult = { inserted: number; skipped: number };

function uniqueBatchIdentities(messages: CanonicalMessage[]): { identities: string[] } {
  const seen = new Set<string>();
  const identities: string[] = [];

  for (const message of sortCanonicalMessages(messages)) {
    const identity = computeMessageIdentity(message);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    identities.push(identity);
  }

  return { identities };
}

export async function previewAppend(
  targetDbPath: string,
  messages: CanonicalMessage[]
): Promise<{ totalInput: number; newRows: number; skippedExisting: number }> {
  const existing = await readAppendedIdentities(targetDbPath);
  const { identities } = uniqueBatchIdentities(messages);
  const newRows = identities.filter((identity) => !existing.has(identity)).length;
  return {
    totalInput: messages.length,
    newRows,
    skippedExisting: messages.length - newRows,
  };
}

export async function applyAppendUpdate(
  targetDbPath: string,
  messages: CanonicalMessage[]
): Promise<AppendResult> {
  const existing = await readAppendedIdentities(targetDbPath);
  const { identities } = uniqueBatchIdentities(messages);
  const insertable = identities.filter((identity) => !existing.has(identity));
  const inserted = await appendIdentities(targetDbPath, insertable);
  return {
    inserted,
    skipped: messages.length - inserted,
  };
}
