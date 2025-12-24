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

  handleResearchRAG = async (
    req: Request<{}, {}, { query: string; topN?: number }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { query, topN = 3 } = req.body;

      if (!query || query.trim().length === 0) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const result = await this.chatService.researchRAG(query, topN);

      res.json({
        success: true,
        query,
        topN,
        responseWithRAG: result.responseWithRAG,
        responseWithoutRAG: result.responseWithoutRAG,
        relevantChunks: result.relevantChunks
      });
    } catch (error) {
      next(error);
    }
  };
}
