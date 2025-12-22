import { Request, Response, NextFunction } from 'express';
import { embeddingRepository } from '../database/embedding.repository';
import { AppError } from '../types';

export class EmbeddingsController {
  /**
   * Get all embeddings
   */
  async getAllEmbeddings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const embeddings = await embeddingRepository.getAllEmbeddings();

      res.json({
        success: true,
        count: embeddings.length,
        embeddings,
      });
    } catch (error) {
      next(new AppError(500, error instanceof Error ? error.message : 'Failed to retrieve embeddings'));
    }
  }

  /**
   * Get embeddings by filename
   */
  async getEmbeddingsByFilename(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;

      if (!filename) {
        throw new AppError(400, 'Filename parameter is required');
      }

      const embeddings = await embeddingRepository.getEmbeddingsByFilename(filename);

      res.json({
        success: true,
        filename,
        count: embeddings.length,
        embeddings,
      });
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError(500, error instanceof Error ? error.message : 'Failed to retrieve embeddings'));
      }
    }
  }

  /**
   * Get embedding count
   */
  async getEmbeddingCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.query;

      const count = await embeddingRepository.getEmbeddingCount(filename as string | undefined);

      res.json({
        success: true,
        count,
        filename: filename || 'all',
      });
    } catch (error) {
      next(new AppError(500, error instanceof Error ? error.message : 'Failed to retrieve embedding count'));
    }
  }

  /**
   * Clear all embeddings
   */
  async clearAllEmbeddings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await embeddingRepository.clearAllEmbeddings();

      res.json({
        success: true,
        message: 'All embeddings cleared successfully',
      });
    } catch (error) {
      next(new AppError(500, error instanceof Error ? error.message : 'Failed to clear embeddings'));
    }
  }
}

export const embeddingsController = new EmbeddingsController();
