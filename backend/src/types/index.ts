import { Response } from 'express';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

export type StreamResponse = Response;

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
