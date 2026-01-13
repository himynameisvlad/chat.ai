export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: TokenUsage;
}

export interface ChatRequest {
  messages: Message[];
  message: string;
  customPrompt?: string;
  temperature?: number;
}

export interface StreamChunk {
  text: string;
}

export interface TokenMetadataEvent {
  type: 'token_usage';
  usage: TokenUsage;
}

export interface SessionTokens {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  message_count: number;
}

export * from './constants';
export * from './types/pr-review.types';
