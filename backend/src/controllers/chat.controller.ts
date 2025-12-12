import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';
import { ChatRequest, ExpressStreamResponse } from '../types';

export class ChatController {
  constructor(private chatService: ChatService) {}

  handleChat = async (
    req: Request<{}, {}, ChatRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { messages, message, customPrompt, temperature } = req.body;

      await this.chatService.processChat(
        messages,
        message,
        res as ExpressStreamResponse,
        customPrompt,
        temperature
      );
    } catch (error) {
      next(error);
    }
  };

  handleHealth = (req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      provider: this.chatService.getProviderName(),
      timestamp: new Date().toISOString(),
    });
  };
}
