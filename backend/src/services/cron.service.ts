import * as cron from 'node-cron';
import { toastService } from './toast.service';

export class CronService {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * Starts all cron jobs
   */
  start(): void {
    // Daily toast at 9:00 AM
    const dailyToastTask = cron.schedule('0 9 * * *', async () => {
      console.log('⏰ Running daily toast cron job');
      try {
        await toastService.broadcastDailyToast();
      } catch (error) {
        console.error('Failed to broadcast daily toast:', error);
      }
    });

    this.tasks.push(dailyToastTask);
    console.log('⏰ Cron jobs started (Daily toast: 9:00 AM)');
  }

  /**
   * Stops all cron jobs
   */
  stop(): void {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('⏰ All cron jobs stopped');
  }

  /**
   * Triggers the daily toast immediately (for testing)
   */
  async triggerDailyToastNow(): Promise<void> {
    console.log('⏰ Manually triggering daily toast');
    await toastService.broadcastDailyToast();
  }
}

export const cronService = new CronService();
