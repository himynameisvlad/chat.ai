import { Request, Response, NextFunction } from 'express';
import { PDFParsingService } from '../services/pdf-parsing.service';
import { ChunkingService } from '../services/chunking.service';
import { OllamaService } from '../services/ollama.service';
import { embeddingRepository } from '../database/embedding.repository';
import * as fs from 'fs';
import * as path from 'path';

export class PDFController {
  private pdfParsingService: PDFParsingService;
  private chunkingService: ChunkingService;
  private ollamaService: OllamaService;

  constructor() {
    this.pdfParsingService = new PDFParsingService();
    this.chunkingService = new ChunkingService();
    this.ollamaService = new OllamaService(
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
    );
  }

  /**
   * Process PDFs: extract text, chunk, generate embeddings, and store in database
   */
  handleProcessPDFs = async (
    req: Request<{}, {}, { folder_path?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const folderPath = req.body.folder_path || process.env.PDF_FOLDER_PATH || 'pdfs';
      const absolutePath = path.isAbsolute(folderPath)
        ? folderPath
        : path.resolve(process.cwd(), folderPath);

      console.log(`[PDF Processing] Processing PDFs in folder: ${absolutePath}`);

      // Check if folder exists
      if (!fs.existsSync(absolutePath)) {
        res.status(404).json({
          success: false,
          error: `Folder not found: ${absolutePath}`,
        });
        return;
      }

      // Check if Ollama is available
      const ollamaAvailable = await this.ollamaService.ping();
      if (!ollamaAvailable) {
        res.status(503).json({
          success: false,
          error: `Ollama is not available. Please ensure Ollama is running on ${
            process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
          }`,
        });
        return;
      }

      // Read all PDF files in the folder
      const files = fs.readdirSync(absolutePath);
      const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        res.json({
          success: true,
          message: `No PDF files found in ${absolutePath}`,
          results: [],
        });
        return;
      }

      console.log(`[PDF Processing] Found ${pdfFiles.length} PDF file(s)`);

      let totalEmbeddings = 0;
      const results: Array<{ filename: string; status: string; embeddings?: number }> = [];

      for (const pdfFile of pdfFiles) {
        try {
          console.log(`[PDF Processing] Processing: ${pdfFile}`);

          // Read PDF file
          const pdfPath = path.join(absolutePath, pdfFile);
          const pdfBuffer = fs.readFileSync(pdfPath);

          // Extract text
          const pdfContent = await this.pdfParsingService.extractText(pdfBuffer);
          console.log(`[PDF Processing] Extracted ${pdfContent.pages} pages from ${pdfFile}`);

          // Chunk text
          const chunks = this.chunkingService.chunkText(pdfContent.text, {
            maxTokens: 256,
            overlap: 25,
          });

          if (chunks.length === 0) {
            results.push({
              filename: pdfFile,
              status: 'No text content found',
            });
            continue;
          }

          console.log(`[PDF Processing] Created ${chunks.length} chunks`);

          // Generate embeddings
          const chunkTexts = chunks.map((chunk) => chunk.text);
          const embeddings = await this.ollamaService.generateEmbeddings(chunkTexts);

          console.log(`[PDF Processing] Generated ${embeddings.length} embeddings`);

          // Save to database
          const embeddingsToSave = embeddings.map((embedding, index) => ({
            filename: pdfFile,
            chunk_index: index,
            chunk_text: chunks[index].text,
            embedding: Array.from(embedding),
            embedding_model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
            dimension: embedding.length,
            token_count: chunks[index].token_count,
          }));

          await embeddingRepository.saveEmbeddings(embeddingsToSave);

          totalEmbeddings += embeddings.length;
          results.push({
            filename: pdfFile,
            status: 'success',
            embeddings: embeddings.length,
          });

          console.log(`[PDF Processing] Saved embeddings for ${pdfFile}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[PDF Processing] Error processing ${pdfFile}: ${errorMessage}`);
          results.push({
            filename: pdfFile,
            status: `error: ${errorMessage}`,
          });
        }
      }

      res.json({
        success: true,
        message: `Processed ${pdfFiles.length} PDF file(s), created ${totalEmbeddings} embeddings`,
        totalFiles: pdfFiles.length,
        totalEmbeddings,
        results,
      });
    } catch (error) {
      next(error);
    }
  };
}
