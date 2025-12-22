import { Router } from 'express';
import { embeddingsController } from '../controllers/embeddings.controller';

export function createEmbeddingsRoutes(): Router {
  const router = Router();

  // GET /embeddings - Get all embeddings
  router.get('/', embeddingsController.getAllEmbeddings.bind(embeddingsController));

  // GET /embeddings/count - Get embedding count (with optional filename query param)
  router.get('/count', embeddingsController.getEmbeddingCount.bind(embeddingsController));

  // GET /embeddings/clear - Clear all embeddings
  router.get('/clear', embeddingsController.clearAllEmbeddings.bind(embeddingsController));

  // GET /embeddings/:filename - Get embeddings by filename
  router.get('/:filename', embeddingsController.getEmbeddingsByFilename.bind(embeddingsController));

  return router;
}
