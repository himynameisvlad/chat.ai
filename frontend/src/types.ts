export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  tokens?: TokenUsage;
}

export interface SessionTokens {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  message_count: number;
}
