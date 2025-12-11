import { IAIProvider } from '../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError } from '../types';

/**
 * Chat Service - Orchestrates chat operations.
 * Follows Dependency Injection principle - receives AI provider via constructor.
 * Follows Single Responsibility Principle - only handles chat orchestration logic.
 */
export class ChatService {
  constructor(private aiProvider: IAIProvider) {}

  /**
   * Processes a chat request and streams the response
   * @param conversationHistory - Previous messages in the conversation
   * @param newMessage - The new message from the user
   * @param response - Express response object for streaming
   * @param customPrompt - Optional custom system prompt
   * @param temperature - Optional temperature parameter for AI response
   */
  async processChat(
    conversationHistory: Message[],
    newMessage: string,
    response: StreamResponse,
    customPrompt?: string,
    temperature?: number
  ): Promise<void> {
    this.validateMessage(newMessage);

    const processedHistory = await this.processHistory(conversationHistory);
    const messages = this.buildConversation(processedHistory, newMessage);

    await this.aiProvider.streamChat(messages, response, customPrompt, temperature);
  }

  /**
   * Validates the user's message
   */
  private validateMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new AppError(400, 'Message is required and cannot be empty');
    }

    if (message.length > 10000) {
      throw new AppError(400, 'Message is too long (max 10000 characters)');
    }
  }

  /**
   * Builds the complete conversation including history and new message
   */
  private buildConversation(
    conversationHistory: Message[],
    newMessage: string
  ): Message[] {
    return [
      ...conversationHistory,
      {
        role: 'user' as const,
        content: newMessage,
      },
    ];
  }

  private async processHistory(history: Message[]): Promise<Message[]> {
    if (history.length <= 10) {
      return history;
    }

    const recentCount = 6;
    const oldMessages = history.slice(0, -recentCount);
    const recentMessages = history.slice(-recentCount);

    const summary = await this.summarizeMessages(oldMessages);

    return [
      { role: 'system' as const, content: `Previous conversation summary: ${summary}` },
      ...recentMessages
    ];
  }

  private async summarizeMessages(messages: Message[]): Promise<string> {
    console.log('summarizeMessages');
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Summarize this conversation concisely in 2-3 sentences. It's important to memorize and retain all critical information, key facts, and important context from the conversation:\n\n${conversationText}`;

    return new Promise((resolve, reject) => {
      let summary = '';

      const mockResponse = {
        setHeader: () => {},
        write: (data: string) => {
          if (data.startsWith('data: ') && !data.includes('[DONE]') && !data.includes('token_usage')) {
            try {
              const jsonStr = data.slice(6).trim();
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                summary += parsed.text;
              }
            } catch {}
          }
        },
        end: () => resolve(summary),
        headersSent: false,
        closed: false,
        writable: true
      } as unknown as StreamResponse;

      this.aiProvider.streamChat(
        [{ role: 'user', content: summaryPrompt }],
        mockResponse
      ).catch(reject);
    });
  }

  /**
   * Returns the name of the current AI provider
   */
  getProviderName(): string {
    return this.aiProvider.getProviderName();
  }
}
