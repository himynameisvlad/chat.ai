interface OllamaEmbeddingResponse {
  embedding: number[];
}

function isOllamaEmbeddingResponse(data: unknown): data is OllamaEmbeddingResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'embedding' in data &&
    Array.isArray((data as OllamaEmbeddingResponse).embedding)
  );
}

export class OllamaService {
  private baseURL: string;
  private embeddingModel: string;
  private timeout: number;

  constructor(
    baseURL: string = 'http://localhost:11434',
    embeddingModel: string = 'nomic-embed-text',
    timeout: number = 30000
  ) {
    this.baseURL = baseURL;
    this.embeddingModel = embeddingModel;
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
  private async generateEmbedding(text: string): Promise<Float32Array> {
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
   * Check if Ollama is available
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
