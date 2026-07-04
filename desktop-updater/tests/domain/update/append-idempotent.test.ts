import { beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { applyAppendUpdate } from '../../../src/domain/update/apply-update';
import { fixtureMessages } from '../fixtures/messages';
import { createArchiveSchemaSql } from '../../../src/domain/archive/schema';
import type { CanonicalMessage } from '../../../src/domain/archive/types';

const dbPath = resolve(process.cwd(), 'tmp', 'idempotent.sqlite');
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type JoinedMessageRow = {
  conversationKey: string;
  authorKey: string;
  timestamp: number;
  body: string;
  hasAttachments: number;
  hasQuote: number;
  quoteBody: string | null;
};

function openDatabase(path: string): InstanceType<typeof DatabaseSync> {
  return new DatabaseSync(path);
}

function readJoinedMessages(path: string): JoinedMessageRow[] {
  const db = openDatabase(path);
  try {
    return db.prepare(`
      SELECT
        c.title AS conversationKey,
        r.display_name AS authorKey,
        m.timestamp,
        m.body,
        m.has_attachments AS hasAttachments,
        m.has_quote AS hasQuote,
        m.quote_body AS quoteBody
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN recipients r ON r.id = m.author_id
      ORDER BY m.id;
    `).all() as JoinedMessageRow[];
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

function seedArchiveWithoutLog(path: string, messages: CanonicalMessage[]): void {
  const db = openDatabase(path);
  try {
    for (const statement of createArchiveSchemaSql()) {
      db.exec(statement);
    }

    const conversationIds = new Map<string, number>();
    const recipientIds = new Map<string, number>();

    const insertConversation = db.prepare(`INSERT INTO conversations (title) VALUES (?);`);
    const insertRecipient = db.prepare(`INSERT INTO recipients (display_name) VALUES (?);`);
    const selectConversationId = db.prepare(`SELECT id FROM conversations WHERE title = ?;`);
    const selectRecipientId = db.prepare(`SELECT id FROM recipients WHERE display_name = ?;`);
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

    for (const message of messages) {
      if (!conversationIds.has(message.conversationKey)) {
        insertConversation.run(message.conversationKey);
        conversationIds.set(
          message.conversationKey,
          (selectConversationId.get(message.conversationKey) as { id: number }).id
        );
      }

      if (!recipientIds.has(message.authorKey)) {
        insertRecipient.run(message.authorKey);
        recipientIds.set(
          message.authorKey,
          (selectRecipientId.get(message.authorKey) as { id: number }).id
        );
      }

      insertMessage.run(
        conversationIds.get(message.conversationKey),
        recipientIds.get(message.authorKey),
        message.timestampMs,
        message.body,
        message.hasAttachments ? 1 : 0,
        message.hasQuote ? 1 : 0,
        message.quoteBody
      );
    }
  } finally {
    db.close();
  }
}

function createLookupTables(path: string): void {
  const db = openDatabase(path);
  try {
    db.exec(`
      CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT);
      CREATE TABLE recipients (id INTEGER PRIMARY KEY, display_name TEXT);
    `);
  } finally {
    db.close();
  }
}

describe('append update', () => {
  beforeEach(async () => {
    await mkdir(resolve(process.cwd(), 'tmp'), { recursive: true });
    await rm(dbPath, { force: true });
  });

  it('inserts canonical message rows on the first run and skips them on the second', async () => {
    const first = await applyAppendUpdate(dbPath, fixtureMessages);
    const second = await applyAppendUpdate(dbPath, fixtureMessages);

    expect(first.inserted).toBeGreaterThan(0);
    expect(second.inserted).toBe(0);

    expect(readTableNames(dbPath)).toEqual(
      expect.arrayContaining(['conversations', 'messages', 'recipients'])
    );
    expect(readJoinedMessages(dbPath)).toEqual([
      {
        conversationKey: 'grp-1',
        authorKey: 'aci-123',
        timestamp: 1710000000000,
        body: 'Hi',
        hasAttachments: 0,
        hasQuote: 0,
        quoteBody: null,
      },
      {
        conversationKey: 'grp-1',
        authorKey: 'aci-124',
        timestamp: 1710000001000,
        body: 'Hello back',
        hasAttachments: 1,
        hasQuote: 0,
        quoteBody: null,
      },
    ]);
  });

  it('recognizes existing archive rows even when the append log table is absent', async () => {
    seedArchiveWithoutLog(dbPath, fixtureMessages);

    const result = await applyAppendUpdate(dbPath, fixtureMessages);

    expect(result).toEqual({ inserted: 0, skipped: fixtureMessages.length });
    expect(readJoinedMessages(dbPath)).toHaveLength(fixtureMessages.length);
  });

  it('remains idempotent after conversations/recipients backfill becomes available', async () => {
    // Create a messages-only archive where conversation_id and author_id are
    // stored as the canonical string keys. This simulates a partially
    // initialized target that later gains lookup tables through schema backfill.
    function seedMessagesOnlyWithStringKeys(path: string, messages: CanonicalMessage[]): void {
      const db = openDatabase(path);
      try {
        // Find the CREATE TABLE statement for messages from the canonical schema
        const msgsSql = createArchiveSchemaSql().find((s) => s.includes('CREATE TABLE messages'));
        if (!msgsSql) throw new Error('messages DDL not found');
        db.exec(msgsSql);

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

        for (const msg of messages) {
          // Intentionally store the canonical conversation/author keys directly
          // into the conversation_id/author_id columns (sqlite allows this).
          insertMessage.run(
            msg.conversationKey,
            msg.authorKey,
            msg.timestampMs,
            msg.body,
            msg.hasAttachments ? 1 : 0,
            msg.hasQuote ? 1 : 0,
            msg.quoteBody
          );
        }
      } finally {
        db.close();
      }
    }

    seedMessagesOnlyWithStringKeys(dbPath, fixtureMessages);
    createLookupTables(dbPath);

    const result = await applyAppendUpdate(dbPath, fixtureMessages);

    expect(result).toEqual({ inserted: 0, skipped: fixtureMessages.length });
    // The messages table should still contain the seeded rows
    const db = openDatabase(dbPath);
    try {
      const rows = db.prepare('SELECT COUNT(*) as c FROM messages;').get() as { c: number };
      expect(rows.c).toBe(fixtureMessages.length);
    } finally {
      db.close();
    }
  });

  it('does not duplicate logical messages when two applies overlap', async () => {
    const first = applyAppendUpdate(dbPath, fixtureMessages);
    const second = applyAppendUpdate(dbPath, fixtureMessages);

    const [a, b] = await Promise.all([first, second]);

    expect(a.inserted + b.inserted).toBe(fixtureMessages.length);

    const db = openDatabase(dbPath);
    try {
      const rows = db.prepare('SELECT COUNT(*) as c FROM messages;').get() as { c: number };
      expect(rows.c).toBe(fixtureMessages.length);
    } finally {
      db.close();
    }
  });
});
