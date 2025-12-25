#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeDatabase } from '../../../database/database';
import { RagService } from '../../rag.service';

const tools = [
  {
    name: 'rag_query',
    description:
      'Query the RAG system to retrieve and search through indexed PDF documents using semantic search with embeddings and LLM-based reranking for best results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query/question to find relevant information',
        },
        topN: {
          type: 'number',
          description: 'Number of chunks to return (default: 3)',
          minimum: 1,
          maximum: 20,
        },
        threshold: {
          type: 'number',
          description: 'Minimum relevance score (0.0-1.0) for results (default: 0.5)',
          minimum: 0.0,
          maximum: 1.0,
        },
        initialTopK: {
          type: 'number',
          description: 'Number of candidates to retrieve before reranking (default: 20)',
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['query'],
    },
  },
];

const ragService = new RagService();

interface RagQueryArgs {
  query: string;
  topN?: number;
  threshold?: number;
  initialTopK?: number;
}

async function handleRagQuery(args: RagQueryArgs): Promise<string> {
  const { query, topN = 3, threshold = 0.5, initialTopK = 20 } = args;

  // Execute query using RagService
  const result = await ragService.query(query, { topN, threshold, initialTopK });

  // Format results for MCP response
  if (result.results.length === 0) {
    return formatNoResults(query, result.metadata.totalChunks, threshold);
  }

  return formatResults(result);
}

function formatNoResults(query: string, totalChunks: number, threshold: number): string {
  return `# RAG Query Results

**Query:** "${query}"
**Status:** No results found

No relevant chunks found above threshold (${threshold}).

**Suggestions:**
- Try lowering the threshold parameter
- Verify your query matches the indexed content
- Check if PDFs are properly indexed using the process_pdfs tool

**Database Info:**
- Total chunks: ${totalChunks}`;
}

function formatResults(result: any): string {
  const resultsSection = result.results
    .map(
      (chunk: any, idx: number) =>
        `## Result ${idx + 1}: ${chunk.filename}

**Chunk:** ${chunk.chunkIndex}
**Relevance Score:** ${chunk.relevanceScore.toFixed(4)}
**Similarity Score:** ${chunk.similarity.toFixed(4)}
**Tokens:** ${chunk.tokenCount}

${chunk.text}

---`
    )
    .join('\n\n');

  return `# RAG Query Results

**Query:** "${result.query}"
**Found:** ${result.results.length} relevant chunk(s)
**Total in DB:** ${result.metadata.totalChunks}
**Threshold:** ${result.metadata.threshold}

---

${resultsSection}

## Metadata

\`\`\`json
${JSON.stringify(
  {
    query: result.query,
    totalChunks: result.metadata.totalChunks,
    candidatesEvaluated: result.metadata.candidatesEvaluated,
    resultsReturned: result.metadata.resultsReturned,
    threshold: result.metadata.threshold,
    results: result.results.map((c: any) => ({
      filename: c.filename,
      chunkIndex: c.chunkIndex,
      similarity: c.similarity,
      relevanceScore: c.relevanceScore,
      tokenCount: c.tokenCount,
    })),
  },
  null,
  2
)}
\`\`\``;
}

const server = new Server(
  {
    name: 'rag-server',
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
      case 'rag_query':
        if (!args || typeof args !== 'object') {
          throw new Error('Invalid arguments');
        }
        result = await handleRagQuery(args as unknown as RagQueryArgs);
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
    console.error('[RAG MCP] Error:', errorMessage);
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
  console.error('RAG MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in RAG MCP Server:', error);
  process.exit(1);
});
