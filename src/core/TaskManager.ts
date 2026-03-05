// src/core/TaskManager.ts
import { TaskStorage } from '../storage/TaskStorage.js';
import { Task, TaskStatus, TaskIndexItem } from '../types.js';

export class TaskManager {
  private storage: TaskStorage;

  constructor(baseDir: string = '.zerocode') {
    this.storage = new TaskStorage(baseDir);
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  async createTask(data: {
    name: string;
    description: string;
    points?: number;
    dependencies?: string[];
    parentId?: string | null;
  }): Promise<Task> {
    return this.storage.createTask(data);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.storage.getTask(id);
  }

  async updateTask(task: Task): Promise<Task> {
    return this.storage.updateTask(task);
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const task = await this.storage.getTask(id);
    if (!task) return null;

    task.status = status;
    return this.storage.updateTask(task);
  }

  async listTasks(): Promise<TaskIndexItem[]> {
    return this.storage.listTasks();
  }

  async getPendingTasks(): Promise<TaskIndexItem[]> {
    const tasks = await this.listTasks();
    return tasks.filter(t => t.status === 'pending' || t.status === 'waiting_dep');
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.storage.getTaskById(id);
  }

  async deleteTask(id: string): Promise<void> {
    return this.storage.deleteTask(id);
  }

  async assignAgent(taskId: string, agentId: string): Promise<Task | null> {
    const task = await this.storage.getTask(taskId);
    if (!task) return null;

    task.agentRef = agentId;
    return this.storage.updateTask(task);
  }

  async findRunnableTask(): Promise<Task | null> {
    const pending = await this.getPendingTasks();
    if (pending.length === 0) return null;

    // Find first pending task whose dependencies are all completed
    for (const task of pending) {
      if (task.status === 'pending' && task.dependencies.length === 0) {
        return this.storage.getTask(task.id);
      }
    }

    return null;
  }
}
