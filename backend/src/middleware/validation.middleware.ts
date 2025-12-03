import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../types';

/**
 * Zod schema for chat request validation
 */
const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1, 'Content cannot be empty'),
    })
  ).default([]),
  message: z.string().min(1, 'Message is required').max(10000, 'Message is too long'),
  useSystemPrompt: z.boolean().optional(),
});

/**
 * Middleware to validate chat requests using Zod.
 * Provides type-safe validation with clear error messages.
 */
export const validateChatRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Validate and parse the request body
    const validatedData = chatRequestSchema.parse(req.body);

    // Replace request body with validated data
    req.body = validatedData;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      // Format Zod validation errors into readable messages
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      next(new AppError(400, `Validation failed: ${errorMessages.join(', ')}`));
    } else {
      next(error);
    }
  }
};
