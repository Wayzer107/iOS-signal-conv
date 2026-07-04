import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const APPEND_LOG_TABLE = 'message_append_log';
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

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

function openDatabaseIfPresent(dbPath: string): Promise<DatabaseSync | null> {
  return fileExists(dbPath).then((exists) => {
    if (!exists) {
      return null;
    }
    return new DatabaseSync(dbPath);
  });
}

function openWritableDatabase(dbPath: string): DatabaseSync {
  return new DatabaseSync(dbPath);
}

export async function readAppendedIdentities(dbPath: string): Promise<Set<string>> {
  const db = await openDatabaseIfPresent(dbPath);
  if (!db) {
    return new Set();
  }

  try {
    const tableCheck = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;`)
      .all(APPEND_LOG_TABLE);
    if (tableCheck.length === 0) {
      return new Set();
    }

    const rows = db.prepare(`SELECT identity FROM ${APPEND_LOG_TABLE};`).all() as Array<{
      identity: string;
    }>;
    return new Set(rows.map((row) => row.identity));
  } finally {
    db.close();
  }
}

export async function appendIdentities(dbPath: string, identities: string[]): Promise<number> {
  if (identities.length === 0) {
    return 0;
  }

  const existing = await readAppendedIdentities(dbPath);
  await mkdir(dirname(dbPath), { recursive: true });
  const db = openWritableDatabase(dbPath);

  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS ${APPEND_LOG_TABLE} (identity TEXT PRIMARY KEY, inserted_at INTEGER NOT NULL);`
    );

    const now = Date.now();
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO ${APPEND_LOG_TABLE} (identity, inserted_at) VALUES (?, ?);`
    );
    for (const identity of identities) {
      stmt.run(identity, now);
    }
  } finally {
    db.close();
  }

  const after = await readAppendedIdentities(dbPath);
  return identities.filter((identity) => !existing.has(identity) && after.has(identity)).length;
}
