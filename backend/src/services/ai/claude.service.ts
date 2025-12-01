import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider } from '../../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError } from '../../types';

interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

/**
 * Claude AI Provider implementation.
 * Follows Single Responsibility Principle - only handles Claude API interactions.
 */
export class ClaudeService implements IAIProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens || 4096;
  }

  async streamChat(messages: Message[], response: StreamResponse): Promise<void> {
    try {
      // Set headers for Server-Sent Events (SSE)
      this.setStreamHeaders(response);

      // Convert messages to Anthropic format
      const formattedMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Create streaming request
      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: formattedMessages,
        stream: true,
      });

      // Stream the response chunks
      await this.processStream(stream, response);

    } catch (error) {
      this.handleStreamError(error, response);
    }
  }

  getProviderName(): string {
    return 'Claude';
  }

  /**
   * Sets appropriate headers for Server-Sent Events streaming
   */
  private setStreamHeaders(response: StreamResponse): void {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
  }

  /**
   * Processes the stream and writes chunks to the response
   */
  private async processStream(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>,
    response: StreamResponse
  ): Promise<void> {
    for await (const event of stream) {
      // Handle content block delta events (text chunks)
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const data = JSON.stringify({ text: event.delta.text });
        response.write(`data: ${data}\n\n`);
      }

      // Handle stream completion
      if (event.type === 'message_stop') {
        response.write('data: [DONE]\n\n');
      }
    }

    response.end();
  }

  /**
   * Handles errors during streaming
   */
  private handleStreamError(error: unknown, response: StreamResponse): void {
    console.error(`[${this.getProviderName()}] Error:`, error);

    if (!response.headersSent) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      throw new AppError(500, `${this.getProviderName()} API error: ${message}`);
    }
  }
}
