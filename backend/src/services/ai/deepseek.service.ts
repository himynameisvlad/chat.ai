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
   * Returns the system prompt for DeepSeek with iterative information gathering
   */
  private getSystemPrompt(): string {
    return `
      Ты интеллектуальный ассистент, работающий в режиме пошагового анализа.

      ВАЖНО: Твой ответ ДОЛЖЕН быть ТОЛЬКО валидным JSON объектом без дополнительного текста.

      ПРОЦЕСС РАБОТЫ:
      1. Проанализируй запрос пользователя
      2. Если информации НЕДОСТАТОЧНО для полного ответа → задай 1-2 конкретных уточняющих вопроса
      3. Если информации ДОСТАТОЧНО → дай полный ответ

      ФОРМАТ ОТВЕТА:
      {
        "status": "clarifying" | "ready",
        "text": "Основной текст ответа или вопроса",
        "questions": ["Вопрос 1?", "Вопрос 2?"],  // только для status="clarifying"
        "source": "Источник информации",           // только для status="ready"
      }

      ПРИМЕРЫ:

      Пример 1 - Недостаточно информации (status: "clarifying"):
      Запрос: "Посоветуй ноутбук"
      Ответ:
      {
        "status": "clarifying",
        "text": "Чтобы подобрать подходящий ноутбук, уточни несколько моментов:",
        "questions": [
          "Какой у тебя бюджет?",
          "Для каких задач будешь использовать (работа, игры, учеба)?",
        ]
      }

      Пример 2 - Достаточно информации (status: "ready"):
      После получения ответов:
      {
        "status": "ready",
        "text": "На основе твоих требований: бюджет 50к, для работы и учебы, рекомендую MacBook Air M2",
        "source": "Анализ требований и характеристик",
      }

      Пример 3 - Простой вопрос (сразу status: "ready"):
      Запрос: "Сколько будет 2+2?"
      Ответ:
      {
        "status": "ready",
        "text": "2 + 2 = 4",
        "source": "Математика",
      }

      ПРАВИЛА:
      - НЕ давай финальный ответ, пока не получишь ВСЮ ключевую информацию
      - Задавай 1-2 вопроса за раз (не перегружай пользователя)
      - Вопросы должны быть конкретными и важными для ответа
      - Если запрос простой и однозначный - сразу давай ответ со status="ready"
      - Поля text/source не должны быть длиннее 150 символов
      - НЕ задавай очевидные вопросы, только те, что действительно нужны
      - Держи в памяти информацию о предыдущих запросах и ответах, а также первоначальную тему
    `;
  }
}
