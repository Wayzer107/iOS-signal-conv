import type { CanonicalMessage } from '../archive/types';
import { computeMessageIdentity, sortCanonicalMessages } from '../archive/writer-contract';
import { appendCanonicalMessages, readPersistedMessageIdentities } from './sqlite-client';

type AppendResult = { inserted: number; skipped: number };

function uniqueBatchMessages(messages: CanonicalMessage[]): CanonicalMessage[] {
  const seen = new Set<string>();
  const unique: CanonicalMessage[] = [];

  for (const message of sortCanonicalMessages(messages)) {
    const identity = computeMessageIdentity(message);
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
  const newRows = uniqueMessages.filter((message) => !existing.has(computeMessageIdentity(message))).length;
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
  const existing = await readPersistedMessageIdentities(targetDbPath);
  const uniqueMessages = uniqueBatchMessages(messages);
  const insertable = uniqueMessages.filter((message) => !existing.has(computeMessageIdentity(message)));
  const inserted = await appendCanonicalMessages(targetDbPath, insertable);
  return {
    inserted,
    skipped: messages.length - inserted,
  };
}
