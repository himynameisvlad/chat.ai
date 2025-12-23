import pdf from 'pdf-parse';
import { PDFContent } from '../types/embedding.types';

export class PDFParsingService {
  /**
   * Extract text from a PDF buffer
   */
  async extractText(buffer: Buffer): Promise<PDFContent> {
    try {
      const data = await pdf(buffer);

      return {
        text: data.text,
        pages: data.numpages,
        metadata: data.info,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse PDF: ${error.message}`);
      }
      throw new Error('Failed to parse PDF: Unknown error');
    }
  }
}
