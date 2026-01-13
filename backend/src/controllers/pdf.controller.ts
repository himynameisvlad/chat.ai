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
   * Process documents (PDFs and text files): extract text, chunk, generate embeddings, and store in database
   */
  handleProcessPDFs = async (
    req: Request<{}, {}, { folder_path?: string; file_path?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { file_path, folder_path } = req.body;

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

      let supportedFiles: { name: string; path: string }[] = [];

      // Process single file if file_path is provided
      if (file_path) {
        const absoluteFilePath = path.isAbsolute(file_path)
          ? file_path
          : path.resolve(process.cwd(), file_path);

        console.log(`[Document Processing] Processing single file: ${absoluteFilePath}`);

        if (!fs.existsSync(absoluteFilePath)) {
          res.status(404).json({
            success: false,
            error: `File not found: ${absoluteFilePath}`,
          });
          return;
        }

        const ext = path.extname(absoluteFilePath).toLowerCase();
        if (ext === '.pdf' || ext === '.txt' || ext === '.env' || ext === '.md' || path.basename(absoluteFilePath).startsWith('.env')) {
          supportedFiles.push({
            name: path.basename(absoluteFilePath),
            path: absoluteFilePath,
          });
        } else {
          res.status(400).json({
            success: false,
            error: `Unsupported file type: ${ext}. Supported types: .pdf, .txt, .env, .md`,
          });
          return;
        }
      } else {
        // Process folder
        const folderPathValue = folder_path || process.env.PDF_FOLDER_PATH || 'pdfs';
        const absolutePath = path.isAbsolute(folderPathValue)
          ? folderPathValue
          : path.resolve(process.cwd(), folderPathValue);

        console.log(`[Document Processing] Processing documents in folder: ${absolutePath}`);

        // Check if folder exists
        if (!fs.existsSync(absolutePath)) {
          res.status(404).json({
            success: false,
            error: `Folder not found: ${absolutePath}`,
          });
          return;
        }

        // Read all supported files in the folder (PDFs and text files)
        const files = fs.readdirSync(absolutePath);
        supportedFiles = files
          .filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return ext === '.pdf' || ext === '.txt' || ext === '.env' || ext === '.md' || file.startsWith('.env');
          })
          .map((file) => ({
            name: file,
            path: path.join(absolutePath, file),
          }));
      }

      if (supportedFiles.length === 0) {
        res.json({
          success: true,
          message: `No supported files found`,
          results: [],
        });
        return;
      }

      console.log(`[Document Processing] Found ${supportedFiles.length} file(s)`);

      let totalEmbeddings = 0;
      const results: Array<{ filename: string; status: string; embeddings?: number }> = [];

      for (const file of supportedFiles) {
        try {
          console.log(`[Document Processing] Processing: ${file.name}`);

          const ext = path.extname(file.name).toLowerCase();
          let text: string;

          // Extract text based on file type
          if (ext === '.pdf') {
            const pdfBuffer = fs.readFileSync(file.path);
            const pdfContent = await this.pdfParsingService.extractText(pdfBuffer);
            text = pdfContent.text;
            console.log(`[Document Processing] Extracted ${pdfContent.pages} pages from ${file.name}`);
          } else {
            // For text files (.txt, .env, .md), read directly
            text = fs.readFileSync(file.path, 'utf-8');
            console.log(`[Document Processing] Read text file ${file.name}`);
          }

          // Chunk text
          const chunks = this.chunkingService.chunkText(text, {
            maxTokens: 256,
            overlap: 25,
          });

          if (chunks.length === 0) {
            results.push({
              filename: file.name,
              status: 'No text content found',
            });
            continue;
          }

          console.log(`[Document Processing] Created ${chunks.length} chunks`);

          // Generate embeddings
          const chunkTexts = chunks.map((chunk) => chunk.text);
          const embeddings = await this.ollamaService.generateEmbeddings(chunkTexts);

          console.log(`[Document Processing] Generated ${embeddings.length} embeddings`);

          // Save to database
          const embeddingsToSave = embeddings.map((embedding, index) => ({
            filename: file.name,
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
            filename: file.name,
            status: 'success',
            embeddings: embeddings.length,
          });

          console.log(`[Document Processing] Saved embeddings for ${file.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Document Processing] Error processing ${file.name}: ${errorMessage}`);
          results.push({
            filename: file.name,
            status: `error: ${errorMessage}`,
          });
        }
      }

      res.json({
        success: true,
        message: `Processed ${supportedFiles.length} file(s), created ${totalEmbeddings} embeddings`,
        totalFiles: supportedFiles.length,
        totalEmbeddings,
        results,
      });
    } catch (error) {
      next(error);
    }
  };
}
