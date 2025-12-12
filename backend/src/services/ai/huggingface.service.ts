import { InferenceClient } from '@huggingface/inference';
import { IAIProvider } from '../../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError } from '../../types';

interface HuggingFaceConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

interface HuggingFaceChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class HuggingFaceService implements IAIProvider {
  private client: InferenceClient;
  private model: string;
  private maxTokens: number;

  constructor(config: HuggingFaceConfig) {
    // InferenceClient automatically routes to third-party providers like Featherless AI
    // based on the model name, no need to specify endpointUrl
    this.client = new InferenceClient(config.apiKey);
    this.model = config.model;
    this.maxTokens = config.maxTokens;
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

      const stream = this.client.chatCompletionStream({
        model: this.model,
        messages: formattedMessages,
        max_tokens: this.maxTokens,
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
    stream: AsyncIterable<HuggingFaceChunk>,
    response: StreamResponse
  ): Promise<void> {
    let streamFinished = false;
    let finalTokenUsage = null;

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;

      if (content) {
        const data = JSON.stringify({ text: content });
        response.write(`data: ${data}\n\n`);
      }

      // Mark stream as finished when we see finish_reason
      if (chunk.choices?.[0]?.finish_reason) {
        streamFinished = true;
      }

      // Store and send token usage when available
      if (chunk.usage) {
        finalTokenUsage = chunk.usage;

        const tokenData = JSON.stringify({
          type: 'token_usage',
          usage: {
            prompt_tokens: finalTokenUsage.prompt_tokens || 0,
            completion_tokens: finalTokenUsage.completion_tokens || 0,
            total_tokens: finalTokenUsage.total_tokens || 0
          }
        });
        response.write(`data: ${tokenData}\n\n`);

        // If stream already finished, send [DONE] now
        if (streamFinished) {
          response.write('data: [DONE]\n\n');
          break;
        }
      }
    }

    // If stream finished but no usage was received, still send [DONE]
    if (streamFinished && !finalTokenUsage) {
      response.write('data: [DONE]\n\n');
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
