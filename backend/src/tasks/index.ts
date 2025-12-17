import { ITask } from './base.task';
import { dailyToastTask } from './daily-toast.task';

export * from './base.task';
export * from './daily-toast.task';

export const tasks: ITask[] = [
  dailyToastTask,
];
