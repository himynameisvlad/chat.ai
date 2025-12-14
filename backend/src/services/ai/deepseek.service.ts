import OpenAI from 'openai';
import { IAIProvider } from '../../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError, DEFAULT_TEMPERATURE } from '../../types';

interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
}

export class DeepSeekService implements IAIProvider {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(config: DeepSeekConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  async streamChat(messages: Message[], response: StreamResponse, customPrompt?: string, temperature?: number): Promise<void> {
    try {
      // Set headers for Server-Sent Events (SSE)
      this.setStreamHeaders(response);

     // const systemPromptContent = customPrompt || this.getDefaultSystemPrompt();

      // const systemMessage: Message = {
      //   role: 'system',
      //   content: systemPromptContent,
      // };

      // const filteredMessages = messages.filter(msg => msg.role !== 'system');
      // const messagesToSend = [systemMessage, ...filteredMessages];

      // Convert messages to OpenAI format
      const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
        messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }));

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: formattedMessages,
        stream: true,
        temperature: temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: this.maxTokens,
      });

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

      // Send token usage when available (typically in final chunk)
      if (chunk.usage) {
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
   * Returns the default system prompt for DeepSeek with iterative information gathering
   */
  private getDefaultSystemPrompt(): string {
    return `Ты интеллектуальный ассистент, работающий в режиме пошагового анализа.

ПРОЦЕСС РАБОТЫ:
1. Проанализируй запрос пользователя
2. Если информации НЕДОСТАТОЧНО для полного ответа → задай 1-2 конкретных уточняющих вопроса
3. Если информации ДОСТАТОЧНО → дай полный развернутый ответ

ПРИМЕРЫ:

Пример 1 - Недостаточно информации:
Запрос: "Посоветуй ноутбук"
Ответ: "Чтобы подобрать подходящий ноутбук, уточни несколько моментов:
- Какой у тебя бюджет?
- Для каких задач будешь использовать (работа, игры, учеба)?"

Пример 2 - Достаточно информации:
После получения ответов: "На основе твоих требований (бюджет 50к, для работы и учебы) рекомендую MacBook Air M2. Он отлично подходит для..."

Пример 3 - Простой вопрос:
Запрос: "Сколько будет 2+2?"
Ответ: "2 + 2 = 4"

ПРАВИЛА:
- НЕ давай финальный ответ, пока не получишь ВСЮ ключевую информацию
- Задавай 1-2 вопроса за раз (не перегружай пользователя)
- Вопросы должны быть конкретными и важными для ответа
- Если запрос простой и однозначный - сразу давай полный ответ
- НЕ задавай очевидные вопросы, только те, что действительно нужны
- Держи в памяти информацию о предыдущих запросах и ответах
- Отвечай на русском языке естественным образом, без специального форматирования`;
  }
}
