import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';
import { ChatRequest } from '../types';

/**
 * Chat Controller - Handles HTTP requests related to chat.
 * Follows Single Responsibility Principle - only handles request/response logic.
 * Uses Dependency Injection to receive ChatService.
 */
export class ChatController {
  constructor(private chatService: ChatService) {}

  /**
   * Handles POST /api/chat requests
   */
  handleChat = async (
    req: Request<{}, {}, ChatRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { messages, message, customPrompt } = req.body;

      await this.chatService.processChat(messages, message, res, customPrompt);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handles GET /api/health requests
   */
  handleHealth = (req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      provider: this.chatService.getProviderName(),
      timestamp: new Date().toISOString(),
    });
  };
}
