import OpenAI from 'openai';
import { IAIProvider } from '../../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError } from '../../types';

interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

/**
 * DeepSeek AI Provider implementation.
 * Follows Single Responsibility Principle - only handles DeepSeek API interactions.
 */
export class DeepSeekService implements IAIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: DeepSeekConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
  }

  async streamChat(messages: Message[], response: StreamResponse, useSystemPrompt?: boolean): Promise<void> {
    try {
      // Set headers for Server-Sent Events (SSE)
      this.setStreamHeaders(response);

      // Add system prompt if requested
      let messagesToSend = messages;
      if (useSystemPrompt) {
        const systemMessage: Message = {
          role: 'system',
          content: this.getSystemPrompt(),
        };
        messagesToSend = [systemMessage, ...messages];
      }

      // Convert messages to OpenAI format
      const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
        messagesToSend.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }));

      // Create streaming request
      const stream = await this.client.chat.completions.create({
        model: this.model,
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
    return 'DeepSeek';
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
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    response: StreamResponse
  ): Promise<void> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;

      if (content) {
        const data = JSON.stringify({ text: content });
        response.write(`data: ${data}\n\n`);
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
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

  /**
   * Returns the system prompt for DeepSeek
   */
  private getSystemPrompt(): string {
    return `
      Формат ответа должен быть в JSON:
      Твой ответ ДОЛЖЕН быть ТОЛЬКО валидным JSON объектом без дополнительного текста.
      Поля не должны содержать строки болльше 100 символов.

      Пример ответа:
      {
        'text': 'Текст ответа',
        'source': 'Источник ответа',
        'tags': ['Теги ответа'],
      }
    `;
  }
}
