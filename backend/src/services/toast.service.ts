import { connectionRegistry } from './connection-registry.service';

export interface DailyToast {
  message: string;
  timestamp: Date;
}

export class ToastService {
  /**
   * Generates the daily toast content
   * Currently returns static text, but can be replaced with AI-generated content in the future
   */
  async generateToastContent(): Promise<string> {
    // Static content for now
    // TODO: Replace with AI-generated content using IAIProvider
    const messages = [
      '💡 Tip of the day: Use MCP tools to enhance your AI interactions!',
      '🌟 Remember: The best way to predict the future is to create it.',
      '🚀 Pro tip: You can use @tools to see all available MCP tools.',
      '💪 Stay productive: Take regular breaks to maintain focus.',
      '🎯 Success tip: Set clear goals for each conversation.',
    ];

    // Rotate messages based on day of year
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const index = dayOfYear % messages.length;

    return messages[index];
  }

  /**
   * Broadcasts the daily toast to all active connections
   */
  async broadcastDailyToast(): Promise<void> {
    const activeConnections = connectionRegistry.getActiveConnectionCount();

    if (activeConnections === 0) {
      console.log('📢 No active connections to broadcast toast');
      return;
    }

    const message = await this.generateToastContent();
    const toast: DailyToast = {
      message,
      timestamp: new Date(),
    };

    console.log(`📢 Broadcasting daily toast to ${activeConnections} connections`);
    connectionRegistry.broadcast('toast', toast);
  }
}

export const toastService = new ToastService();
