import { Router } from 'express';
import { mcpController } from '../controllers/mcp.controller';

export function createMCPRoutes(): Router {
  const router = Router();

  router.get('/tools', mcpController.listTools.bind(mcpController));
  router.get('/status', mcpController.getStatus.bind(mcpController));
  router.post('/connect', mcpController.connect.bind(mcpController));
  router.post('/disconnect', mcpController.disconnect.bind(mcpController));

  return router;
}
