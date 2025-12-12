import { type Message, type TokenUsage } from '../types';
import { config } from '../config/app.config';
import { withRetry } from '../utils/retry';

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

export class ChatService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl: string = config.api.baseUrl, timeout: number = config.api.timeout) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Sends a message and streams the response
   * @param messages - Conversation history
   * @param message - New message to send
   * @param onChunk - Callback for each text chunk received
   * @param onTokens - Callback for token usage information
   * @param customPrompt - Optional custom system prompt
   * @param temperature - Temperature parameter for AI response
   */
  async sendMessage(
    messages: Message[],
    message: string,
    onChunk: (text: string) => void,
    onTokens: (usage: TokenUsage) => void,
    customPrompt?: string,
    temperature?: number
  ): Promise<void> {
    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, message, customPrompt, temperature }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new ChatServiceError(
            `Failed to send message: ${response.statusText}`,
            response.status
          );
        }

        await this.processStream(response, onChunk, onTokens);
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ChatServiceError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new ChatServiceError('Request timeout - please try again');
        }

        throw new ChatServiceError(
          error instanceof Error ? error.message : 'An unknown error occurred'
        );
      }
    });
  }

  /**
   * Processes the streaming response
   * @private
   */
  private async processStream(
    response: Response,
    onChunk: (text: string) => void,
    onTokens: (usage: TokenUsage) => void
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

              // Handle text chunks
              if (parsed.text) {
                onChunk(parsed.text);
              }

              // Handle token usage events
              if (parsed.type === 'token_usage' && parsed.usage) {
                onTokens(parsed.usage);
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
