import { InferenceClient } from '@huggingface/inference';
import { IAIProvider } from '../../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError } from '../../types';

interface HuggingFaceConfig {
  apiKey: string;
  model: string;
}

export class HuggingFaceService implements IAIProvider {
  private client: InferenceClient;
  private model: string;

  constructor(config: HuggingFaceConfig) {
    // InferenceClient automatically routes to third-party providers like Featherless AI
    // based on the model name, no need to specify endpointUrl
    this.client = new InferenceClient(config.apiKey);
    this.model = config.model;
  }

  async streamChat(messages: Message[], response: StreamResponse, customPrompt?: string, temperature?: number): Promise<void> {
    try {
      // Set headers for Server-Sent Events (SSE)
      this.setStreamHeaders(response);

      // Convert messages to HuggingFace chat format
      const formattedMessages = messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      // Create streaming request with Featherless AI provider
      const stream = this.client.chatCompletionStream({
        model: this.model,
        messages: formattedMessages,
        max_tokens: 2048,
        provider: 'featherless-ai', // Use Featherless AI provider
      });

      // Stream the response chunks
      await this.processStream(stream, response);
    } catch (error) {
      this.handleStreamError(error, response);
    }
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
    stream: AsyncIterable<any>,
    response: StreamResponse
  ): Promise<void> {
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;

      if (content) {
        const data = JSON.stringify({ text: content });
        response.write(`data: ${data}\n\n`);
      }

      // Log and send token usage if available
      if (chunk.usage) {
        // Keep logging for debugging
        console.log(`[${this.getProviderName()}] Token usage:`, {
          prompt_tokens: chunk.usage.prompt_tokens,
          completion_tokens: chunk.usage.completion_tokens,
          total_tokens: chunk.usage.total_tokens,
        });

        // Send to frontend
        const tokenData = JSON.stringify({
          type: 'token_usage',
          usage: {
            prompt_tokens: chunk.usage.prompt_tokens || 0,
            completion_tokens: chunk.usage.completion_tokens || 0,
            total_tokens: chunk.usage.total_tokens || 0
          }
        });
        response.write(`data: ${tokenData}\n\n`);
      }

      if (chunk.choices?.[0]?.finish_reason) {
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

  getProviderName(): string {
    return 'HuggingFace';
  }
}
