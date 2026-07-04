import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import type { CanonicalMessage } from '../archive/types';
import { createArchiveSchemaSql } from '../archive/schema';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type SqliteDatabase = InstanceType<typeof DatabaseSync>;

type PersistedMessageRow = {
  conversationId: string | number | bigint;
  authorId: string | number | bigint;
  timestampMs: number;
  body: string;
  hasAttachments: number;
  hasQuote: number;
  quoteBody: string | null;
};

function stableNumericId(value: string): bigint {
  const digest = createHash('sha256').update(value, 'utf8').digest('hex');
  const unsigned = BigInt(`0x${digest.slice(0, 16)}`);
  const signedLimit = 0x7fffffffffffffffn;
  const fullRange = 0x10000000000000000n;
  const normalized = unsigned > signedLimit ? unsigned - fullRange : unsigned;
  return normalized === 0n ? 1n : normalized;
}

export function computeAppendIdentity(message: Pick<
  CanonicalMessage,
  'conversationKey' | 'authorKey' | 'timestampMs' | 'body' | 'hasAttachments' | 'hasQuote' | 'quoteBody'
>): string {
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

function normalizePersistedId(rawValue: unknown): string {
  if (typeof rawValue === 'bigint' || typeof rawValue === 'number' || typeof rawValue === 'string') {
    return String(rawValue);
  }

  return '';
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
  // Task 5 applies message-only writes, so we intentionally initialize only the
  // message-bearing tables needed for append and search sync.
  for (const sql of createArchiveSchemaSql().filter((statement) => {
    return (
      /^\s*CREATE\s+TABLE\s+messages\b/i.test(statement) ||
      /^\s*CREATE\s+VIRTUAL\s+TABLE\s+messages_fts\b/i.test(statement) ||
      /^\s*CREATE\s+TABLE\s+schema_info\b/i.test(statement)
    );
  })) {
    const trimmed = sql.trim().replace(/;$/, '');
    if (/^CREATE\s+VIRTUAL\s+TABLE/i.test(trimmed)) {
      // Ensure virtual tables include IF NOT EXISTS
      const rest = trimmed.replace(/^CREATE\s+VIRTUAL\s+TABLE\s+/i, '');
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${rest};`);
    } else if (/^CREATE\s+TABLE/i.test(trimmed)) {
      const rest = trimmed.replace(/^CREATE\s+TABLE\s+/i, '');
      db.exec(`CREATE TABLE IF NOT EXISTS ${rest};`);
    } else {
      db.exec(trimmed + ';');
    }
  }
}

function readPersistedMessages(db: SqliteDatabase): PersistedMessageRow[] {
  if (!tableExists(db, 'messages')) {
    return [];
  }

  return db
    .prepare(`
      SELECT
        CAST(COALESCE(m.conversation_id, '') AS TEXT) AS conversationId,
        CAST(COALESCE(m.author_id, '') AS TEXT) AS authorId,
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
      conversationId: row.conversationId == null ? '' : normalizePersistedId(row.conversationId),
      authorId: row.authorId == null ? '' : normalizePersistedId(row.authorId),
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
      [
        normalizePersistedId(row.conversationId),
        normalizePersistedId(row.authorId),
        String(row.timestampMs),
        row.body,
        row.hasAttachments ? '1' : '0',
        row.hasQuote ? '1' : '0',
        row.quoteBody ?? '',
      ].join('|')
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
    const insertMessageFts = db.prepare(`INSERT INTO messages_fts (rowid, body) VALUES (?, ?);`);
    const readLastInsertRowId = db.prepare(`SELECT last_insert_rowid() AS id;`);

    let inserted = 0;
    for (const message of messages) {
      const identity = computeAppendIdentity(message);
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
