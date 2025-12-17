import { Message, StreamResponse } from '../types';
import OpenAI from 'openai';

export interface IAIProvider {
  streamChat(
    messages: Message[],
    response: StreamResponse,
    customPrompt?: string,
    temperature?: number,
    tools?: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<void>;
  getProviderName(): string;
}
