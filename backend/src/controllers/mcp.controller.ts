import { Request, Response, NextFunction } from 'express';
import { mcpClientService, mcpInitializationService } from '../services/mcp';
import { AppError } from '../types';

export class MCPController {
  async listTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!mcpClientService.isClientConnected()) {
        await mcpClientService.connect();
      }

      const tools = await mcpClientService.listTools();

      res.json({
        success: true,
        tools,
        count: tools.length,
      });
    } catch (error) {
      next(new AppError(500, error instanceof Error ? error.message : 'Failed to list MCP tools'));
    }
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      connected: mcpClientService.isClientConnected(),
    });
  }

  async connect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await mcpClientService.connect();

      res.json({
        success: true,
        message: 'Connected to Google Calendar MCP',
      });
    } catch (error) {
      next(new AppError(500, error instanceof Error ? error.message : 'Failed to connect to MCP'));
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await mcpClientService.disconnect();

      res.json({
        success: true,
        message: 'Disconnected from Google Calendar MCP',
      });
    } catch (error) {
      next(new AppError(500, error instanceof Error ? error.message : 'Failed to disconnect from MCP'));
    }
  }
}

export const mcpController = new MCPController();
