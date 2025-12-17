import { Request, Response } from 'express';
import { connectionRegistry } from '../services/connection-registry.service';
import { randomUUID } from 'crypto';

export class SSEController {
  /**
   * Establishes a persistent SSE connection
   * Keeps connection alive with heartbeat messages
   */
  async connect(req: Request, res: Response): Promise<void> {
    const connectionId = randomUUID();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Register connection
    connectionRegistry.register(connectionId, res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`);

    // Setup heartbeat to keep connection alive (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      if (res.closed || !res.writable) {
        clearInterval(heartbeatInterval);
        connectionRegistry.unregister(connectionId);
        return;
      }

      res.write(`: heartbeat\n\n`);
    }, 30000);

    // Cleanup on connection close
    const cleanup = () => {
      clearInterval(heartbeatInterval);
      connectionRegistry.unregister(connectionId);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);

    // Keep the connection open
    req.on('close', cleanup);
  }

  /**
   * Get active connection count (for monitoring)
   */
  getStatus(req: Request, res: Response): void {
    const count = connectionRegistry.getActiveConnectionCount();
    res.json({
      activeConnections: count,
      timestamp: new Date().toISOString(),
    });
  }
}

export const sseController = new SSEController();
