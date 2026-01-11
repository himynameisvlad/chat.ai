import { Router } from 'express';
import { PDFController } from '../controllers/pdf.controller';

/**
 * Creates and configures PDF processing routes
 */
export const createPDFRoutes = (pdfController: PDFController): Router => {
  const router = Router();

  // POST /api/pdf/process - Process PDFs and generate embeddings
  router.post('/process', pdfController.handleProcessPDFs);

  return router;
};
