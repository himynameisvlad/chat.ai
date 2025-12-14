export const migration = {
  name: '001_initial_schema',
  up: `
    CREATE TABLE IF NOT EXISTS conversation_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
  down: `
    DROP TABLE IF EXISTS conversation_summaries;
  `
};
