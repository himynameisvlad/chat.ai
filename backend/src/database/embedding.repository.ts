import { db } from './database';
import { DatabaseError } from './errors';
import { PDFEmbedding } from '../types/embedding.types';
import { parseEmbedding } from '../utils/vector.utils';

type PDFEmbeddingRow = Omit<PDFEmbedding, 'embedding'> & { embedding: string };

export class EmbeddingRepository {
  /**
   * Save multiple embeddings to the database
   */
  async saveEmbeddings(embeddings: Omit<PDFEmbedding, 'id' | 'created_at'>[]): Promise<void> {
    if (embeddings.length === 0) {
      return;
    }

    try {
      // Use a transaction for bulk insert
      await db.run('BEGIN TRANSACTION');

      for (const embedding of embeddings) {
        await db.run(
          `INSERT INTO pdf_embeddings (filename, chunk_index, chunk_text, embedding, embedding_model, dimension, token_count)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          embedding.filename,
          embedding.chunk_index,
          embedding.chunk_text || null,
          JSON.stringify(embedding.embedding),
          embedding.embedding_model,
          embedding.dimension,
          embedding.token_count || null
        );
      }

      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw new DatabaseError('Failed to save embeddings', 'saveEmbeddings', error as Error);
    }
  }

  /**
   * Get all embeddings for a specific filename
   */
  async getEmbeddingsByFilename(filename: string): Promise<PDFEmbedding[]> {
    try {
      const results = await db.all<PDFEmbeddingRow>(
        `SELECT * FROM pdf_embeddings WHERE filename = ? ORDER BY chunk_index ASC`,
        filename
      );
      return results.map(row => ({
        ...row,
        embedding: parseEmbedding(row.embedding)
      }));
    } catch (error) {
      throw new DatabaseError('Failed to get embeddings by filename', 'getEmbeddingsByFilename', error as Error);
    }
  }

  /**
   * Get all embeddings
   */
  async getAllEmbeddings(): Promise<PDFEmbedding[]> {
    try {
      const results = await db.all<PDFEmbeddingRow>(
        `SELECT * FROM pdf_embeddings ORDER BY filename, chunk_index ASC`
      );
      return results.map(row => ({
        ...row,
        embedding: parseEmbedding(row.embedding)
      }));
    } catch (error) {
      throw new DatabaseError('Failed to get all embeddings', 'getAllEmbeddings', error as Error);
    }
  }

  /**
   * Clear all embeddings from the database
   */
  async clearAllEmbeddings(): Promise<void> {
    try {
      await db.run('DELETE FROM pdf_embeddings');
    } catch (error) {
      throw new DatabaseError('Failed to clear embeddings', 'clearAllEmbeddings', error as Error);
    }
  }

  /**
   * Get count of embeddings for a specific filename
   */
  async getEmbeddingCount(filename?: string): Promise<number> {
    try {
      const query = filename
        ? `SELECT COUNT(*) as count FROM pdf_embeddings WHERE filename = ?`
        : `SELECT COUNT(*) as count FROM pdf_embeddings`;

      const result = await db.get<{ count: number }>(
        query,
        ...(filename ? [filename] : [])
      );

      return result?.count || 0;
    } catch (error) {
      throw new DatabaseError('Failed to get embedding count', 'getEmbeddingCount', error as Error);
    }
  }
}

export const embeddingRepository = new EmbeddingRepository();
