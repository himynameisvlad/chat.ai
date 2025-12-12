import { Response } from 'express';

export * from '@chat-ai/shared';

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
