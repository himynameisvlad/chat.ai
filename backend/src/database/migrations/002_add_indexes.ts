export const migration = {
  name: '002_add_indexes',
  up: `
    CREATE INDEX IF NOT EXISTS idx_session_id
    ON conversation_summaries(session_id);

    CREATE INDEX IF NOT EXISTS idx_updated_at
    ON conversation_summaries(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_session_updated
    ON conversation_summaries(session_id, updated_at DESC);
  `,
  down: `
    DROP INDEX IF EXISTS idx_session_id;
    DROP INDEX IF EXISTS idx_updated_at;
    DROP INDEX IF EXISTS idx_session_updated;
  `
};
