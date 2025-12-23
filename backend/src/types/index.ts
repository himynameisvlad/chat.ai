import { Response } from 'express';

export * from '@chat-ai/shared';
export * from './embedding.types';

export interface StreamResponse {
  setHeader(name: string, value: string | number | readonly string[]): void;
  write(chunk: string): boolean;
  end(): void;
  headersSent: boolean;
  closed: boolean;
  writable: boolean;
}

export type ExpressStreamResponse = Response;

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
