interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

interface RerankResult {
  index: number;
  relevanceScore: number;
}

function isOllamaEmbeddingResponse(data: unknown): data is OllamaEmbeddingResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'embedding' in data &&
    Array.isArray((data as OllamaEmbeddingResponse).embedding)
  );
}

function isOllamaGenerateResponse(data: unknown): data is OllamaGenerateResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'response' in data &&
    typeof (data as OllamaGenerateResponse).response === 'string'
  );
}

export class OllamaService {
  private baseURL: string;
  private embeddingModel: string;
  private rerankModel: string;
  private timeout: number;

  constructor(
    baseURL: string = 'http://127.0.0.1:11434',
    embeddingModel: string = 'nomic-embed-text',
    rerankModel: string = 'llama3.2:3b',  // Larger model for better understanding
    timeout: number = 30000
  ) {
    this.baseURL = baseURL;
    this.embeddingModel = embeddingModel;
    this.rerankModel = rerankModel;
    this.timeout = timeout;
  }

  /**
   * Generate embeddings for multiple texts using Ollama
   */
  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const embeddings: Float32Array[] = [];

    // Process texts one at a time to avoid overwhelming Ollama
    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for text: ${error}`);
        throw error;
      }
    }

    return embeddings;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: unknown = await response.json();

      if (!isOllamaEmbeddingResponse(data)) {
        throw new Error('Invalid response from Ollama API: missing or invalid embedding array');
      }

      console.log(data);

      return new Float32Array(data.embedding);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Ollama request timed out after ${this.timeout}ms`);
        }
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Rerank documents based on relevance to query using LLM
   * @param query - The search query
   * @param documents - Array of documents to rerank
   * @returns Array of rerank results with indices and relevance scores
   */
  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    const results: RerankResult[] = [];

    for (let i = 0; i < documents.length; i++) {
      try {
        const relevanceScore = await this.evaluateRelevance(query, documents[i]);
        results.push({
          index: i,
          relevanceScore,
        });
      } catch (error) {
        console.error(`Failed to evaluate relevance for document ${i}:`, error);
        // Assign a low score on error
        results.push({
          index: i,
          relevanceScore: 0,
        });
      }
    }

    // Sort by relevance score in descending order
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Evaluate relevance of a document to a query using LLM
   * @param query - The search query
   * @param document - The document text
   * @returns Relevance score between 0 and 1
   */
  private async evaluateRelevance(query: string, document: string): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const prompt = `Does this text answer the query? Rate 0.0-1.0.
1.0 = directly answers
0.5 = partially relevant
0.0 = not relevant

Query: ${query}

Text: ${document.substring(0, 500)}

Only reply with a number:`;

    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.rerankModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent scoring
            num_predict: 5,   // Very short - just a number
            stop: ['\n', ' ', 'Explanation', 'The', 'I'],  // Stop after the number
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: unknown = await response.json();

      if (!isOllamaGenerateResponse(data)) {
        throw new Error('Invalid response from Ollama API');
      }

      // Extract number from response
      const responseText = data.response.trim();
      console.log(`LLM response for relevance: "${responseText}"`);

      // Try to extract a number from the response
      // Match patterns like: 0.5, .5, 0, 1, 1.0
      const scoreMatch = responseText.match(/(\d*\.?\d+)/);
      if (!scoreMatch) {
        console.warn(`Could not parse relevance score from: "${responseText}", defaulting to 0.5`);
        return 0.5;
      }

      const score = parseFloat(scoreMatch[1]);
      console.log(`Parsed score: ${score}`);

      // Clamp between 0 and 1
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Ollama rerank request timed out after ${this.timeout}ms`);
        }
        throw new Error(`Failed to evaluate relevance: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Check if Ollama is available
   */
  async ping(): Promise<boolean> {
    try {
      console.log(`Pinging Ollama at ${this.baseURL}/api/version`);
      const response = await fetch(`${this.baseURL}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      console.log(`Ollama response status: ${response.status}, ok: ${response.ok}`);
      return response.ok;
    } catch (error) {
      console.error('Ollama ping failed:', error);
      return false;
    }
  }
}
