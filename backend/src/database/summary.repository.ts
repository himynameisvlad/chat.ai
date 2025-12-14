import { db } from './database';
import { DatabaseError } from './errors';

export interface ConversationSummary {
  id: number;
  session_id: string;
  summary_text: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export class SummaryRepository {
  async getLatestSummary(): Promise<ConversationSummary | undefined> {
    try {
      const result = await db.get<ConversationSummary>(`
        SELECT * FROM conversation_summaries
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      return result;
    } catch (error) {
      throw new DatabaseError('Failed to get latest summary', 'getLatestSummary', error as Error);
    }
  }

  async saveSummary(summaryText: string, messageCount: number): Promise<void> {
    this.validateSummary(summaryText, messageCount);

    try {
      await db.run(
        'INSERT INTO conversation_summaries (session_id, summary_text, message_count) VALUES (?, ?, ?)',
        'default',
        summaryText,
        messageCount
      );
    } catch (error) {
      throw new DatabaseError('Failed to save summary', 'saveSummary', error as Error);
    }
  }

  async clearAllSummaries(): Promise<void> {
    try {
      await db.run('DELETE FROM conversation_summaries');
    } catch (error) {
      throw new DatabaseError('Failed to clear summaries', 'clearAllSummaries', error as Error);
    }
  }

  async getAllSummaries(): Promise<ConversationSummary[]> {
    try {
      const result = await db.all<ConversationSummary>(
        'SELECT * FROM conversation_summaries ORDER BY updated_at DESC'
      );
      return result;
    } catch (error) {
      throw new DatabaseError('Failed to get all summaries', 'getAllSummaries', error as Error);
    }
  }

  private validateSummary(text: string, count: number): void {
    if (!text || text.trim().length === 0) {
      throw new Error('Summary text cannot be empty');
    }
    if (count < 0) {
      throw new Error('Message count must be non-negative');
    }
    if (text.length > 10000) {
      throw new Error('Summary text is too long (max 10000 characters)');
    }
  }
}

export const summaryRepository = new SummaryRepository();
