import { Message, StreamResponse } from '../types';

export interface IAIProvider {
  streamChat(messages: Message[], response: StreamResponse, customPrompt?: string, temperature?: number): Promise<void>;
  getProviderName(): string;
}
