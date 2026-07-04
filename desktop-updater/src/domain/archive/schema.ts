// Schema helpers for the iOS archive
export function createArchiveSchemaSql(): string[] {
  return [
    'CREATE TABLE recipients (id INTEGER PRIMARY KEY, display_name TEXT);',
    'CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT);',
    'CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER, author_id INTEGER, timestamp INTEGER, body TEXT, has_attachments INTEGER, has_quote INTEGER, quote_body TEXT);',
    'CREATE VIRTUAL TABLE messages_fts USING fts5(body);',
    'CREATE TABLE schema_info (key TEXT PRIMARY KEY, value TEXT);',
  ];
}
