export const migration = {
  name: '004_pdf_embeddings',
  up: `
    CREATE TABLE IF NOT EXISTS pdf_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT,
      embedding TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      dimension INTEGER NOT NULL,
      token_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_embeddings_filename ON pdf_embeddings(filename);
    CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON pdf_embeddings(created_at DESC);
  `,
  down: `
    DROP INDEX IF EXISTS idx_embeddings_created_at;
    DROP INDEX IF EXISTS idx_embeddings_filename;
    DROP TABLE IF EXISTS pdf_embeddings;
  `
};
