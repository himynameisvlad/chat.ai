import { connectionRegistry } from './connection-registry.service';

export interface DailyToast {
  message: string;
  timestamp: Date;
}

export class ToastService {
  async broadcastToast(message: string): Promise<void> {
    const activeConnections = connectionRegistry.getActiveConnectionCount();

    if (activeConnections === 0) {
      console.log('📢 No active connections to broadcast toast');
      return;
    }

    const toast: DailyToast = {
      message,
      timestamp: new Date(),
    };

    console.log(`📢 Broadcasting toast to ${activeConnections} connections`);
    connectionRegistry.broadcast('toast', toast);
  }
}

export const toastService = new ToastService();
