export interface FormattedResponse {
  text: string;
  source: string;
  tags: string[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  formattedContent?: FormattedResponse;
}
