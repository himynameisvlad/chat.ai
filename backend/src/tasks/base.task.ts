export interface ITask {
  name: string;
  schedule: string;
  execute(): Promise<void>;
}
