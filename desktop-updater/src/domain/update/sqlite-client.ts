import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const APPEND_LOG_TABLE = 'message_append_log';

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

async function runSqlite(dbPath: string, sql: string): Promise<string> {
  try {
    const result = await execFileAsync('sqlite3', [dbPath, sql], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return String(result.stdout ?? '');
  } catch (error) {
    throw new Error(`sqlite3 failed for ${dbPath}: ${(error as Error).message}`);
  }
}

async function ensureAppendLogTable(dbPath: string): Promise<void> {
  await runSqlite(
    dbPath,
    `CREATE TABLE IF NOT EXISTS ${APPEND_LOG_TABLE} (identity TEXT PRIMARY KEY, inserted_at INTEGER NOT NULL);`
  );
}

export async function readAppendedIdentities(dbPath: string): Promise<Set<string>> {
  await ensureAppendLogTable(dbPath);
  const output = await runSqlite(dbPath, `SELECT identity FROM ${APPEND_LOG_TABLE};`);
  const identities = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return new Set(identities);
}

export async function appendIdentities(dbPath: string, identities: string[]): Promise<number> {
  await ensureAppendLogTable(dbPath);
  if (identities.length === 0) {
    return 0;
  }

  const now = Date.now();
  const values = identities
    .map((identity) => `('${escapeSqlLiteral(identity)}', ${now})`)
    .join(', ');
  const sql = `BEGIN; INSERT OR IGNORE INTO ${APPEND_LOG_TABLE} (identity, inserted_at) VALUES ${values}; COMMIT;`;
  await runSqlite(dbPath, sql);

  const after = await readAppendedIdentities(dbPath);
  return identities.filter((identity) => after.has(identity)).length;
}

