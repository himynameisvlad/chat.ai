import { ITask } from './base.task';
import { toastService } from '../services/toast.service';
import { ChatService } from '../services/chat.service';

export class DailyToastTask implements ITask {
  name = 'daily-toast';
  schedule = '0 9 * * *';

  constructor(private chatService: ChatService) {}

  async execute(): Promise<void> {
    console.log('⏰ Running daily toast task');
    try {
      const message = await this.chatService.getResponse('Возьми доступные методы из mcp и верни только список названий этих методов без описания и без каких то других инструкций');
      await toastService.broadcastToast(message);
    } catch (error) {
      console.error('Failed to execute daily toast task:', error);
      throw error;
    }
  }
}
