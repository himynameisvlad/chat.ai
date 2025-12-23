import { encode } from 'gpt-3-encoder';
import { ChunkOptions, TextChunk } from '../types/embedding.types';

export class ChunkingService {
  /**
   * Split text into fixed-size chunks with overlap using GPT-3 tokenizer
   */
  chunkText(text: string, options: ChunkOptions = { maxTokens: 512, overlap: 50 }): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const { maxTokens, overlap } = options;
    const chunks: TextChunk[] = [];

    // Split text into sentences for better chunking
    const sentences = this.splitIntoSentences(text);

    let currentChunk: string[] = [];
    let currentTokenCount = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = encode(sentence).length;

      // If adding this sentence exceeds maxTokens, save current chunk
      if (currentTokenCount + sentenceTokens > maxTokens && currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        chunks.push({
          text: chunkText,
          token_count: currentTokenCount,
          chunk_index: chunkIndex,
        });

        // Start new chunk with overlap
        // Keep last few sentences for overlap
        const overlapSentences: string[] = [];
        let overlapTokens = 0;

        for (let j = currentChunk.length - 1; j >= 0 && overlapTokens < overlap; j--) {
          const sent = currentChunk[j];
          const tokens = encode(sent).length;
          if (overlapTokens + tokens <= overlap) {
            overlapSentences.unshift(sent);
            overlapTokens += tokens;
          } else {
            break;
          }
        }

        currentChunk = overlapSentences;
        currentTokenCount = overlapTokens;
        chunkIndex++;
      }

      currentChunk.push(sentence);
      currentTokenCount += sentenceTokens;
    }

    // Add the last chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      chunks.push({
        text: chunkText,
        token_count: currentTokenCount,
        chunk_index: chunkIndex,
      });
    }

    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting by period, exclamation, question mark
    // Followed by space or newline
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}
