import * as cron from 'node-cron';
import { ITask } from '../tasks/base.task';

export class CronService {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private registeredTasks: Map<string, ITask> = new Map();

  registerTask(task: ITask): void {
    this.registeredTasks.set(task.name, task);
    console.log(`⏰ Task registered: ${task.name} (${task.schedule})`);
  }

  start(): void {
    if (this.registeredTasks.size === 0) {
      console.log('⏰ No tasks to schedule');
      return;
    }

    for (const [name, task] of this.registeredTasks.entries()) {
      const scheduledTask = cron.schedule(task.schedule, async () => {
        try {
          await task.execute();
        } catch (error) {
          console.error(`Failed to execute task ${name}:`, error);
        }
      });

      this.scheduledTasks.set(name, scheduledTask);
    }

    console.log(`⏰ Started ${this.scheduledTasks.size} cron job(s)`);
  }

  stop(): void {
    this.scheduledTasks.forEach(task => task.stop());
    this.scheduledTasks.clear();
    console.log('⏰ All cron jobs stopped');
  }

  async executeTask(taskName: string): Promise<void> {
    const task = this.registeredTasks.get(taskName);
    if (!task) {
      throw new Error(`Task not found: ${taskName}`);
    }

    console.log(`⏰ Manually executing task: ${taskName}`);
    await task.execute();
  }

  getRegisteredTasks(): string[] {
    return Array.from(this.registeredTasks.keys());
  }
}

export const cronService = new CronService();
