/**
 * Parse embedding from database (handles both string and array formats)
 */
export function parseEmbedding(embedding: string | number[]): number[] {
  if (typeof embedding === 'string') {
    return JSON.parse(embedding) as number[];
  }
  return embedding;
}
