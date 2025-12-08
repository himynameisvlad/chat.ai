import { Message, StreamResponse } from '../types';

/**
 * Interface for AI providers following the Interface Segregation Principle.
 * Any AI provider (DeepSeek, OpenAI, Claude, etc.) must implement this contract.
 */
export interface IAIProvider {
  /**
   * Creates a streaming chat completion
   * @param messages - Conversation history
   * @param response - Express response object for streaming
   * @param customPrompt - Optional custom system prompt (if not provided, uses default)
   * @returns Promise that resolves when streaming is complete
   */
  streamChat(messages: Message[], response: StreamResponse, customPrompt?: string): Promise<void>;

  /**
   * Returns the provider name for logging/debugging
   */
  getProviderName(): string;
}
