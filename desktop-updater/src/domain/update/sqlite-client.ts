import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import type { CanonicalMessage } from '../archive/types';
import { computeMessageIdentity } from '../archive/writer-contract';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type SqliteDatabase = InstanceType<typeof DatabaseSync>;

type PersistedMessageRow = {
  conversationKey: string;
  authorKey: string;
  timestampMs: number;
  body: string;
  hasAttachments: number;
  hasQuote: number;
  quoteBody: string | null;
};

function fileExists(dbPath: string): Promise<boolean> {
  return access(dbPath, constants.F_OK)
    .then(() => true)
    .catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
        return false;
      }
      throw error;
    });
}

function openDatabaseIfPresent(dbPath: string): Promise<SqliteDatabase | null> {
  return fileExists(dbPath).then((exists) => {
    if (!exists) {
      return null;
    }

    return new DatabaseSync(dbPath);
  });
}

function openWritableDatabase(dbPath: string): SqliteDatabase {
  return new DatabaseSync(dbPath);
}

function tableExists(db: SqliteDatabase, tableName: string): boolean {
  const rows = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1;`)
    .all(tableName);
  return rows.length > 0;
}

function ensureArchiveSchema(db: SqliteDatabase): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS recipients (id INTEGER PRIMARY KEY, display_name TEXT);'
  );
  db.exec('CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY, title TEXT);');
  db.exec(
    'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, conversation_id INTEGER, author_id INTEGER, timestamp INTEGER, body TEXT, has_attachments INTEGER, has_quote INTEGER, quote_body TEXT);'
  );
}

function getOrCreateId(
  db: SqliteDatabase,
  tableName: 'conversations' | 'recipients',
  columnName: 'title' | 'display_name',
  value: string
): number {
  const select = db
    .prepare(`SELECT id FROM ${tableName} WHERE ${columnName} = ? ORDER BY id LIMIT 1;`)
    .get(value) as { id: number } | undefined;
  if (select) {
    return select.id;
  }

  db.prepare(`INSERT INTO ${tableName} (${columnName}) VALUES (?);`).run(value);
  return (db.prepare(`SELECT id FROM ${tableName} WHERE ${columnName} = ? ORDER BY id LIMIT 1;`).get(value) as {
    id: number;
  }).id;
}

function readPersistedMessages(db: SqliteDatabase): PersistedMessageRow[] {
  if (!tableExists(db, 'messages')) {
    return [];
  }

  if (!tableExists(db, 'conversations') || !tableExists(db, 'recipients')) {
    return [];
  }

  return db
    .prepare(`
      SELECT
        COALESCE(c.title, '') AS conversationKey,
        COALESCE(r.display_name, '') AS authorKey,
        COALESCE(m.timestamp, 0) AS timestampMs,
        COALESCE(m.body, '') AS body,
        COALESCE(m.has_attachments, 0) AS hasAttachments,
        COALESCE(m.has_quote, 0) AS hasQuote,
        m.quote_body AS quoteBody
      FROM messages m
      LEFT JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN recipients r ON r.id = m.author_id
      ORDER BY m.id;
    `)
    .all() as PersistedMessageRow[];
}

export async function readPersistedMessageIdentities(dbPath: string): Promise<Set<string>> {
  const db = await openDatabaseIfPresent(dbPath);
  if (!db) {
    return new Set();
  }

  try {
    return new Set(
      readPersistedMessages(db).map((row) =>
        computeMessageIdentity({
          conversationKey: row.conversationKey,
          authorKey: row.authorKey,
          timestampMs: row.timestampMs,
          body: row.body,
          hasAttachments: Boolean(row.hasAttachments),
          hasQuote: Boolean(row.hasQuote),
          quoteBody: row.quoteBody,
        })
      )
    );
  } finally {
    db.close();
  }
}

export async function appendCanonicalMessages(
  dbPath: string,
  messages: CanonicalMessage[]
): Promise<number> {
  if (messages.length === 0) {
    return 0;
  }

  await mkdir(dirname(dbPath), { recursive: true });
  const db = openWritableDatabase(dbPath);

  try {
    ensureArchiveSchema(db);
    db.exec('BEGIN IMMEDIATE;');

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
      const conversationId = getOrCreateId(db, 'conversations', 'title', message.conversationKey);
      const authorId = getOrCreateId(db, 'recipients', 'display_name', message.authorKey);

      insertMessage.run(
        conversationId,
        authorId,
        message.timestampMs,
        message.body,
        message.hasAttachments ? 1 : 0,
        message.hasQuote ? 1 : 0,
        message.quoteBody
      );
    }

    db.exec('COMMIT;');
    return messages.length;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback failures and rethrow the original error.
    }
    throw error;
  } finally {
    db.close();
  }
}
