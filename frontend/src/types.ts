export interface ClarifyingResponse {
  status: 'clarifying';
  text: string;
  questions: string[];
}

export interface ReadyResponse {
  status: 'ready';
  text: string;
  source?: string;
}

export type FormattedResponse = ClarifyingResponse | ReadyResponse;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  formattedContent?: FormattedResponse;
  expectsFormatted?: boolean;
}
