export interface PDFEmbedding {
  id: number;
  filename: string;
  chunk_index: number;
  embedding: number[];
  embedding_model: string;
  dimension: number;
  token_count?: number;
  created_at: string;
}

export interface PDFContent {
  text: string;
  pages: number;
  metadata?: any;
}

export interface ChunkOptions {
  maxTokens: number;
  overlap: number;
}

export interface TextChunk {
  text: string;
  token_count: number;
  chunk_index: number;
}
