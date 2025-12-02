import { type Message } from '../types';
import { config } from '../config/app.config';

/**
 * Custom error class for chat service errors
 */
export class ChatServiceError extends Error {
  public statusCode?: number;

  constructor(
    message: string,
    statusCode?: number
  ) {
    super(message);
    this.name = 'ChatServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Chat Service
 * Handles all communication with the chat API
 * Follows Single Responsibility Principle - only handles API communication
 */
export class ChatService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = config.api.baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * Sends a message and streams the response
   * @param messages - Conversation history
   * @param message - New message to send
   * @param onChunk - Callback for each text chunk received
   * @param useSystemPrompt - Whether to include system prompt
   */
  async sendMessage(
    messages: Message[],
    message: string,
    onChunk: (text: string) => void,
    useSystemPrompt?: boolean
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, message, useSystemPrompt }),
      });

      if (!response.ok) {
        throw new ChatServiceError(
          `Failed to send message: ${response.statusText}`,
          response.status
        );
      }

      await this.processStream(response, onChunk);
    } catch (error) {
      if (error instanceof ChatServiceError) {
        throw error;
      }

      throw new ChatServiceError(
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  }

  /**
   * Processes the streaming response
   * @private
   */
  private async processStream(
    response: Response,
    onChunk: (text: string) => void
  ): Promise<void> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new ChatServiceError('No response body received');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                onChunk(parsed.text);
              }
            } catch (e) {
              console.error('Failed to parse chunk:', e);
              // Continue processing other chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Health check endpoint
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export a singleton instance
export const chatService = new ChatService();
