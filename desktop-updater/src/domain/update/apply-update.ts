import type { CanonicalMessage } from '../archive/types';
import { sortCanonicalMessages } from '../archive/writer-contract';
import { appendCanonicalMessages, readPersistedMessageIdentities, computeAppendIdentity } from './sqlite-client';

type AppendResult = { inserted: number; skipped: number };

function uniqueBatchMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  const seen = new Set<string>();
  const unique: CanonicalMessage[] = [];

  for (const message of sortCanonicalMessages(messages)) {
    const identity = computeAppendIdentity(message);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    unique.push(message);
  }

  return unique;
}

export async function previewAppend(
  targetDbPath: string,
  messages: CanonicalMessage[]
): Promise<{ totalInput: number; newRows: number; skippedExisting: number }> {
  const existing = await readPersistedMessageIdentities(targetDbPath);
  const uniqueMessages = uniqueBatchMessages(messages);
  const newRows = uniqueMessages.filter((message) => !existing.has(computeAppendIdentity(message))).length;
  const skippedExisting = uniqueMessages.length - newRows; // only count rows skipped because they already exist in DB
  return {
    totalInput: messages.length,
    newRows,
    skippedExisting,
  };
}

export async function applyAppendUpdate(
  targetDbPath: string,
  messages: CanonicalMessage[]
): Promise<AppendResult> {
  const uniqueMessages = uniqueBatchMessages(messages);
  const inserted = await appendCanonicalMessages(targetDbPath, uniqueMessages);
  return {
    inserted,
    skipped: messages.length - inserted,
  };
}
