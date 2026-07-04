import { beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { applyAppendUpdate } from '../../../src/domain/update/apply-update';
import type { CanonicalMessage } from '../../../src/domain/archive/types';
import { fixtureMessages } from '../fixtures/messages';

const dbPath = resolve(process.cwd(), 'tmp', 'idempotent.sqlite');
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type MessageRow = {
  id: number;
  conversationId: string;
  authorId: string;
  timestamp: number;
  body: string;
  hasAttachments: number;
  hasQuote: number;
  quoteBody: string | null;
};

type FtsRow = {
  rowid: number;
  body: string;
};

function openDatabase(path: string): InstanceType<typeof DatabaseSync> {
  return new DatabaseSync(path);
}

function stableNumericId(value: string): bigint {
  const digest = createHash('sha256').update(value, 'utf8').digest('hex');
  const unsigned = BigInt(`0x${digest.slice(0, 16)}`);
  const signedLimit = 0x7fffffffffffffffn;
  const fullRange = 0x10000000000000000n;
  const normalized = unsigned > signedLimit ? unsigned - fullRange : unsigned;
  return normalized === 0n ? 1n : normalized;
}

function appendIdentity(message: CanonicalMessage): string {
  return [
    stableNumericId(message.conversationKey).toString(),
    stableNumericId(message.authorKey).toString(),
    String(message.timestampMs),
    message.body,
    message.hasAttachments ? '1' : '0',
    message.hasQuote ? '1' : '0',
    message.quoteBody ?? '',
  ].join('|');
}

function readMessages(path: string): MessageRow[] {
  const db = openDatabase(path);
  try {
    return db.prepare(`
      SELECT
        id,
        CAST(conversation_id AS TEXT) AS conversationId,
        CAST(author_id AS TEXT) AS authorId,
        timestamp,
        body,
        has_attachments AS hasAttachments,
        has_quote AS hasQuote,
        quote_body AS quoteBody
      FROM messages
      ORDER BY id;
    `).all() as MessageRow[];
  } finally {
    db.close();
  }
}

function readMessageFts(path: string): FtsRow[] {
  const db = openDatabase(path);
  try {
    return db.prepare(`
      SELECT rowid, body
      FROM messages_fts
      ORDER BY rowid;
    `).all() as FtsRow[];
  } finally {
    db.close();
  }
}

function readTableNames(path: string): string[] {
  const db = openDatabase(path);
  try {
    return db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;`)
      .all()
      .map((row) => (row as { name: string }).name);
  } finally {
    db.close();
  }
}

function seedMessageOnlyArchive(path: string, messages: CanonicalMessage[]): void {
  const db = openDatabase(path);
  try {
    db.exec(`
      CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER, author_id INTEGER, timestamp INTEGER, body TEXT, has_attachments INTEGER, has_quote INTEGER, quote_body TEXT);
      CREATE VIRTUAL TABLE messages_fts USING fts5(body);
      CREATE TABLE schema_info (key TEXT PRIMARY KEY, value TEXT);
    `);

    const insertMessage = db.prepare(`
      INSERT INTO messages (
        conversation_id,
        author_id,
        timestamp,
        body,
        has_attachments,
        has_quote,
        quote_body
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `);
    const insertMessageFts = db.prepare(`INSERT INTO messages_fts (rowid, body) VALUES (?, ?);`);
    const readLastInsertRowId = db.prepare(`SELECT last_insert_rowid() AS id;`);
    const seen = new Set<string>();

    for (const message of messages) {
      const identity = appendIdentity(message);
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);

      insertMessage.run(
        stableNumericId(message.conversationKey),
        stableNumericId(message.authorKey),
        message.timestampMs,
        message.body,
        message.hasAttachments ? 1 : 0,
        message.hasQuote ? 1 : 0,
        message.quoteBody
      );

      const insertedRow = readLastInsertRowId.get() as { id: number | bigint };
      insertMessageFts.run(insertedRow.id, message.body);
    }
  } finally {
    db.close();
  }
}

describe('append update', () => {
  beforeEach(async () => {
    await mkdir(resolve(process.cwd(), 'tmp'), { recursive: true });
    await rm(dbPath, { force: true });
  });

  it('inserts canonical message rows on the first run, skips them on the second, and keeps FTS in sync', async () => {
    const first = await applyAppendUpdate(dbPath, fixtureMessages);
    const second = await applyAppendUpdate(dbPath, fixtureMessages);

    expect(first.inserted).toBe(fixtureMessages.length);
    expect(second).toEqual({ inserted: 0, skipped: fixtureMessages.length });

    const tableNames = readTableNames(dbPath);
    expect(tableNames).toEqual(expect.arrayContaining(['messages', 'messages_fts', 'schema_info']));
    expect(tableNames).not.toEqual(expect.arrayContaining(['conversations', 'recipients']));

    expect(readMessages(dbPath)).toEqual([
      {
        id: 1,
        conversationId: stableNumericId('grp-1').toString(),
        authorId: stableNumericId('aci-123').toString(),
        timestamp: 1710000000000,
        body: 'Hi',
        hasAttachments: 0,
        hasQuote: 0,
        quoteBody: null,
      },
      {
        id: 2,
        conversationId: stableNumericId('grp-1').toString(),
        authorId: stableNumericId('aci-124').toString(),
        timestamp: 1710000001000,
        body: 'Hello back',
        hasAttachments: 1,
        hasQuote: 0,
        quoteBody: null,
      },
    ]);

    expect(readMessageFts(dbPath)).toEqual([
      { rowid: 1, body: 'Hi' },
      { rowid: 2, body: 'Hello back' },
    ]);
  });

  it('recognizes existing message-only rows without lookup tables', async () => {
    seedMessageOnlyArchive(dbPath, fixtureMessages);

    const result = await applyAppendUpdate(dbPath, fixtureMessages);

    expect(result).toEqual({ inserted: 0, skipped: fixtureMessages.length });
    expect(readMessages(dbPath)).toHaveLength(fixtureMessages.length);
    expect(readMessageFts(dbPath)).toHaveLength(fixtureMessages.length);
  });

  it('does not duplicate logical messages when two applies overlap', async () => {
    const first = applyAppendUpdate(dbPath, fixtureMessages);
    const second = applyAppendUpdate(dbPath, fixtureMessages);

    const [a, b] = await Promise.all([first, second]);

    expect(a.inserted + b.inserted).toBe(fixtureMessages.length);
    expect(readMessages(dbPath)).toHaveLength(fixtureMessages.length);
    expect(readMessageFts(dbPath)).toHaveLength(fixtureMessages.length);
  });
});
