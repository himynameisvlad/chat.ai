import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { validateChatRequest } from '../middleware/validation.middleware';

/**
 * Creates and configures chat routes.
 * Separation of concerns - routes are defined separately from controllers.
 */
export const createChatRoutes = (chatController: ChatController): Router => {
  const router = Router();

  // POST /api/chat - Send a message and receive streaming response
  router.post('/chat', validateChatRequest, chatController.handleChat);

  // GET /api/health - Health check endpoint
  router.get('/health', chatController.handleHealth);

  return router;
};
