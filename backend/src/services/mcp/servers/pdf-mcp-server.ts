#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { PDFParsingService } from '../../pdf-parsing.service';
import { ChunkingService } from '../../chunking.service';
import { OllamaService } from '../../ollama.service';
import { embeddingRepository } from '../../../database/embedding.repository';
import { initializeDatabase } from '../../../database/database';

const tools = [
  {
    name: 'process_pdfs',
    description: 'Process all PDF files in the specified folder, extract text, chunk it, generate embeddings via Ollama, and store embeddings in SQLite.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_path: {
          type: 'string',
          description: 'Path to the folder containing PDF files. If not specified, uses PDF_FOLDER_PATH environment variable.',
        },
      },
    },
  },
];

const pdfParsingService = new PDFParsingService();
const chunkingService = new ChunkingService();
const ollamaService = new OllamaService(
  process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  parseInt(process.env.OLLAMA_TIMEOUT || '30000', 10)
);

async function processPDFs(args: any) {
  const folderPath = args.folder_path || process.env.PDF_FOLDER_PATH || 'pokemons/pdf';
  const absolutePath = path.isAbsolute(folderPath) ? folderPath : path.resolve(process.cwd(), folderPath);

  console.error(`[PDF MCP] Processing PDFs in folder: ${absolutePath}`);

  // Check if folder exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Folder not found: ${absolutePath}`);
  }

  // Check if Ollama is available
  const ollamaAvailable = await ollamaService.ping();
  if (!ollamaAvailable) {
    throw new Error('Ollama is not available. Please ensure Ollama is running on ' + (process.env.OLLAMA_BASE_URL || 'http://localhost:11434'));
  }

  // Read all PDF files in the folder
  const files = fs.readdirSync(absolutePath);
  const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    return `No PDF files found in ${absolutePath}`;
  }

  console.error(`[PDF MCP] Found ${pdfFiles.length} PDF file(s)`);

  let totalEmbeddings = 0;
  const results: string[] = [];

  for (const pdfFile of pdfFiles) {
    try {
      console.error(`[PDF MCP] Processing: ${pdfFile}`);

      // Read PDF file
      const pdfPath = path.join(absolutePath, pdfFile);
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Extract text
      const pdfContent = await pdfParsingService.extractText(pdfBuffer);
      console.error(`[PDF MCP] Extracted ${pdfContent.pages} pages from ${pdfFile}`);

      // Chunk text
      const chunks = chunkingService.chunkText(pdfContent.text, {
        maxTokens: 512,
        overlap: 50,
      });

      if (chunks.length === 0) {
        results.push(`${pdfFile}: No text content found`);
        continue;
      }

      console.error(`[PDF MCP] Created ${chunks.length} chunks`);

      // Generate embeddings
      const chunkTexts = chunks.map(chunk => chunk.text);
      const embeddings = await ollamaService.generateEmbeddings(chunkTexts);

      console.error(`[PDF MCP] Generated ${embeddings.length} embeddings`);

      // Save to database
      const embeddingsToSave = embeddings.map((embedding, index) => ({
        filename: pdfFile,
        chunk_index: index,
        embedding: Array.from(embedding),
        embedding_model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
        dimension: embedding.length,
        token_count: chunks[index].token_count,
      }));

      await embeddingRepository.saveEmbeddings(embeddingsToSave);

      totalEmbeddings += embeddings.length;
      results.push(`${pdfFile}: ${embeddings.length} embeddings created`);

      console.error(`[PDF MCP] Saved embeddings for ${pdfFile}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PDF MCP] Error processing ${pdfFile}: ${errorMessage}`);
      results.push(`${pdfFile}: Error - ${errorMessage}`);
    }
  }

  const summary = `Processed ${pdfFiles.length} PDF file(s), created ${totalEmbeddings} embeddings\n\nDetails:\n${results.join('\n')}`;
  return summary;
}

const server = new Server(
  {
    name: 'pdf-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'process_pdfs':
        result = await processPDFs(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  await initializeDatabase();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PDF MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in PDF MCP Server:', error);
  process.exit(1);
});
