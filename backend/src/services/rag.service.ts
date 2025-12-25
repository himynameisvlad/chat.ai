import { OllamaService } from './ollama.service';
import { embeddingRepository } from '../database/embedding.repository';
import { cosineSimilarity } from '../utils/vector.utils';

export interface RagQueryOptions {
  topN?: number;
  threshold?: number;
  initialTopK?: number;
}

export interface RagChunkResult {
  text: string;
  filename: string;
  chunkIndex: number;
  similarity: number;
  relevanceScore: number;
  tokenCount: number;
}

export interface RagQueryResult {
  query: string;
  results: RagChunkResult[];
  metadata: {
    totalChunks: number;
    candidatesEvaluated: number;
    resultsReturned: number;
    threshold: number;
  };
}

export class RagService {
  private ollamaService: OllamaService;

  constructor() {
    this.ollamaService = new OllamaService(
      process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
    );
  }

  /**
   * Query the RAG system with semantic search and LLM-based reranking
   * @param query - The search query
   * @param options - Query options (topN, threshold, initialTopK)
   * @returns Query results with chunks and metadata
   */
  async query(query: string, options: RagQueryOptions = {}): Promise<RagQueryResult> {
    const { topN = 3, threshold = 0.5, initialTopK = 20 } = options;

    console.error(`[RAG Service] Query: "${query}", TopN: ${topN}, Threshold: ${threshold}`);

    // Check if Ollama is available
    const isOllamaAvailable = await this.ollamaService.ping();
    if (!isOllamaAvailable) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running.');
    }

    // Generate embedding for the query
    console.error('[RAG Service] Generating query embedding...');
    const queryEmbedding = await this.ollamaService.generateEmbedding(query);

    // Get all embeddings from database
    const allEmbeddings = await embeddingRepository.getAllEmbeddings();

    if (allEmbeddings.length === 0) {
      throw new Error(
        'No embeddings found in database. Please use the process_pdfs tool to index PDF files first.'
      );
    }

    console.error(`[RAG Service] Found ${allEmbeddings.length} embeddings in database`);

    // Calculate similarity for each embedding and sort by similarity
    const similarities = allEmbeddings
      .map((emb) => ({
        ...emb,
        similarity: cosineSimilarity(queryEmbedding, emb.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Get initial candidates
    const candidates = similarities.slice(0, Math.min(initialTopK, similarities.length));

    console.error(`[RAG Service] Selected ${candidates.length} candidates for reranking`);

    // Rerank using LLM for best relevance
    const documents = candidates.map((c) => c.chunk_text || '');
    const rerankResults = await this.ollamaService.rerank(query, documents);

    console.error('[RAG Service] Reranking complete');

    // Filter and get top results
    const rankedCandidates = rerankResults.map((result) => ({
      ...candidates[result.index],
      relevanceScore: result.relevanceScore,
    }));

    const results: RagChunkResult[] = rankedCandidates
      .filter((chunk) => chunk.relevanceScore >= threshold)
      .slice(0, topN)
      .map((chunk) => ({
        text: chunk.chunk_text || '',
        filename: chunk.filename,
        chunkIndex: chunk.chunk_index,
        similarity: chunk.similarity,
        relevanceScore: chunk.relevanceScore,
        tokenCount: chunk.token_count || 0,
      }));

    console.error(`[RAG Service] Returning ${results.length} results`);

    return {
      query,
      results,
      metadata: {
        totalChunks: allEmbeddings.length,
        candidatesEvaluated: candidates.length,
        resultsReturned: results.length,
        threshold,
      },
    };
  }

  /**
   * Check if Ollama service is available
   */
  async isAvailable(): Promise<boolean> {
    return this.ollamaService.ping();
  }

  /**
   * Get the count of embeddings in the database
   */
  async getEmbeddingCount(): Promise<number> {
    return embeddingRepository.getEmbeddingCount();
  }
}
