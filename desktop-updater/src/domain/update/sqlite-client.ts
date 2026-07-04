import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import type { CanonicalMessage } from '../archive/types';
import { createArchiveSchemaSql } from '../archive/schema';
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

function normalizePersistedKey(rawValue: unknown, joinedValue: unknown): string {
  if (typeof rawValue === 'string') {
    return rawValue;
  }

  if (rawValue != null) {
    return joinedValue == null ? String(rawValue) : String(joinedValue);
  }

  return joinedValue == null ? '' : String(joinedValue);
}

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
  // Create all tables defined by the Task 2 archive contract. Use the centralized
  // schema helper so tests and other code share the same DDL.
  for (const sql of createArchiveSchemaSql()) {
    const trimmed = sql.trim().replace(/;$/, '');
    if (/^CREATE\s+VIRTUAL\s+TABLE/i.test(trimmed)) {
      // Ensure virtual tables include IF NOT EXISTS
      const rest = trimmed.replace(/^CREATE\s+VIRTUAL\s+TABLE\s+/i, '');
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${rest};`);
    } else if (/^CREATE\s+TABLE/i.test(trimmed)) {
      const rest = trimmed.replace(/^CREATE\s+TABLE\s+/i, '');
      db.exec(`CREATE TABLE IF NOT EXISTS ${rest};`);
    } else {
      // Fallback to executing the provided statement as-is
      db.exec(trimmed + ';');
    }
  }
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

  const hasConversations = tableExists(db, 'conversations');
  const hasRecipients = tableExists(db, 'recipients');

  if (hasConversations && hasRecipients) {
    // Normal case: use joins when they resolve, but preserve any raw string keys
    // already stored in message rows so schema backfills do not change identity.
    return db
      .prepare(`
        SELECT
          m.conversation_id AS conversationRaw,
          c.title AS conversationJoined,
          m.author_id AS authorRaw,
          r.display_name AS authorJoined,
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
      .all()
      .map((row: any) => ({
        conversationKey: normalizePersistedKey(row.conversationRaw, row.conversationJoined),
        authorKey: normalizePersistedKey(row.authorRaw, row.authorJoined),
        timestampMs: Number(row.timestampMs) || 0,
        body: row.body == null ? '' : String(row.body),
        hasAttachments: Number(row.hasAttachments) || 0,
        hasQuote: Number(row.hasQuote) || 0,
        quoteBody: row.quoteBody == null ? null : String(row.quoteBody),
      })) as PersistedMessageRow[];
  }

  if (hasConversations) {
    return db
      .prepare(`
        SELECT
          m.conversation_id AS conversationRaw,
          c.title AS conversationJoined,
          m.author_id AS authorRaw,
          NULL AS authorJoined,
          COALESCE(m.timestamp, 0) AS timestampMs,
          COALESCE(m.body, '') AS body,
          COALESCE(m.has_attachments, 0) AS hasAttachments,
          COALESCE(m.has_quote, 0) AS hasQuote,
          m.quote_body AS quoteBody
        FROM messages m
        LEFT JOIN conversations c ON c.id = m.conversation_id
        ORDER BY m.id;
      `)
      .all()
      .map((row: any) => ({
        conversationKey: normalizePersistedKey(row.conversationRaw, row.conversationJoined),
        authorKey: normalizePersistedKey(row.authorRaw, row.authorJoined),
        timestampMs: Number(row.timestampMs) || 0,
        body: row.body == null ? '' : String(row.body),
        hasAttachments: Number(row.hasAttachments) || 0,
        hasQuote: Number(row.hasQuote) || 0,
        quoteBody: row.quoteBody == null ? null : String(row.quoteBody),
      })) as PersistedMessageRow[];
  }

  if (hasRecipients) {
    return db
      .prepare(`
        SELECT
          m.conversation_id AS conversationRaw,
          NULL AS conversationJoined,
          m.author_id AS authorRaw,
          r.display_name AS authorJoined,
          COALESCE(m.timestamp, 0) AS timestampMs,
          COALESCE(m.body, '') AS body,
          COALESCE(m.has_attachments, 0) AS hasAttachments,
          COALESCE(m.has_quote, 0) AS hasQuote,
          m.quote_body AS quoteBody
        FROM messages m
        LEFT JOIN recipients r ON r.id = m.author_id
        ORDER BY m.id;
      `)
      .all()
      .map((row: any) => ({
        conversationKey: normalizePersistedKey(row.conversationRaw, row.conversationJoined),
        authorKey: normalizePersistedKey(row.authorRaw, row.authorJoined),
        timestampMs: Number(row.timestampMs) || 0,
        body: row.body == null ? '' : String(row.body),
        hasAttachments: Number(row.hasAttachments) || 0,
        hasQuote: Number(row.hasQuote) || 0,
        quoteBody: row.quoteBody == null ? null : String(row.quoteBody),
      })) as PersistedMessageRow[];
  }

  return db
    .prepare(`
      SELECT
        COALESCE(m.conversation_id, '') AS conversationKey,
        COALESCE(m.author_id, '') AS authorKey,
        COALESCE(m.timestamp, 0) AS timestampMs,
        COALESCE(m.body, '') AS body,
        COALESCE(m.has_attachments, 0) AS hasAttachments,
        COALESCE(m.has_quote, 0) AS hasQuote,
        m.quote_body AS quoteBody
      FROM messages m
      ORDER BY m.id;
    `)
    .all()
    .map((row: any) => ({
      conversationKey: row.conversationKey == null ? '' : String(row.conversationKey),
      authorKey: row.authorKey == null ? '' : String(row.authorKey),
      timestampMs: Number(row.timestampMs) || 0,
      body: row.body == null ? '' : String(row.body),
      hasAttachments: Number(row.hasAttachments) || 0,
      hasQuote: Number(row.hasQuote) || 0,
      quoteBody: row.quoteBody == null ? null : String(row.quoteBody),
    })) as PersistedMessageRow[];
}

function readPersistedMessageIdentitiesFromDb(db: SqliteDatabase): Set<string> {
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
}

export async function readPersistedMessageIdentities(dbPath: string): Promise<Set<string>> {
  const db = await openDatabaseIfPresent(dbPath);
  if (!db) {
    return new Set();
  }

  try {
    return readPersistedMessageIdentitiesFromDb(db);
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
    const existing = readPersistedMessageIdentitiesFromDb(db);
    const seen = new Set(existing);

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

    let inserted = 0;
    for (const message of messages) {
      const identity = computeMessageIdentity(message);
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);

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
      inserted += 1;
    }

    db.exec('COMMIT;');
    return inserted;
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
