import { ITask } from './base.task';
import { toastService } from '../services/toast.service';

export class DailyToastTask implements ITask {
  name = 'daily-toast';
  schedule = '0 9 * * *';

  async execute(): Promise<void> {
    console.log('⏰ Running daily toast task');
    try {
      await toastService.broadcastDailyToast();
    } catch (error) {
      console.error('Failed to execute daily toast task:', error);
      throw error;
    }
  }
}

export const dailyToastTask = new DailyToastTask();
