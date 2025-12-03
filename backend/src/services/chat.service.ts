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
   * @param useSystemPrompt - Whether to include system prompt
   */
  async processChat(
    conversationHistory: Message[],
    newMessage: string,
    response: StreamResponse,
    useSystemPrompt?: boolean
  ): Promise<void> {
    this.validateMessage(newMessage);

    // Build complete conversation
    const messages = this.buildConversation(conversationHistory, newMessage);

    // Delegate to AI provider
    await this.aiProvider.streamChat(messages, response, useSystemPrompt);
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

  /**
   * Returns the name of the current AI provider
   */
  getProviderName(): string {
    return this.aiProvider.getProviderName();
  }
}
