// src/core/Executor.ts
import { TaskManager } from './TaskManager.js';
import { AgentManager } from './AgentManager.js';
import { SelfHealer } from './SelfHealer.js';
import { TaskStatus } from '../types.js';

export interface ExecutionResult {
  success: boolean;
  error?: string;
  retryCount?: number;
}

export interface TaskExecutor {
  execute: () => Promise<ExecutionResult>;
}

export class Executor {
  private taskManager: TaskManager;
  private agentManager: AgentManager;
  private selfHealer: SelfHealer;
  private maxRetries: number;

  constructor(baseDir: string = '.zerocode', maxRetries: number = 3) {
    this.taskManager = new TaskManager(baseDir);
    this.agentManager = new AgentManager(baseDir);
    this.selfHealer = new SelfHealer(baseDir, maxRetries);
    this.maxRetries = maxRetries;
  }

  async initialize(): Promise<void> {
    await this.taskManager.initialize();
    await this.agentManager.initialize();
    await this.selfHealer.initialize();
  }

  async executeTask(taskId: string, executor: TaskExecutor): Promise<ExecutionResult> {
    // Update task status to processing
    await this.taskManager.updateTaskStatus(taskId, 'processing');

    let result: ExecutionResult;
    let retryCount = 0;

    while (true) {
      // Execute the task
      result = await executor.execute();

      if (result.success) {
        // Task succeeded
        await this.taskManager.updateTaskStatus(taskId, 'completed');
        await this.selfHealer.clearFailures(taskId);
        return result;
      }

      // Task failed - record failure
      await this.selfHealer.recordFailure({
        taskId,
        error: result.error || 'Unknown error',
        rootCause: '', // Would be filled by LLM analysis
        fixAttempt: '', // Would be filled by LLM
        success: false,
      });

      retryCount++;
      result.retryCount = retryCount;

      // Check if can retry
      const canRetry = await this.selfHealer.canRetry(taskId);
      if (!canRetry) {
        await this.taskManager.updateTaskStatus(taskId, 'failed');
        return result;
      }

      // Ask user if they want to continue (placeholder)
      // In real implementation, would prompt user

      // For now, stop after one retry in MVP
      break;
    }

    // If we exit the loop without returning, mark as failed
    if (!result.success) {
      await this.taskManager.updateTaskStatus(taskId, 'failed');
    }

    return result;
  }

  async executeWithHealing(
    taskId: string,
    executor: TaskExecutor,
    heal: (error: string) => Promise<boolean>
  ): Promise<ExecutionResult> {
    await this.taskManager.updateTaskStatus(taskId, 'processing');

    let result: ExecutionResult;
    let retryCount = 0;

    while (true) {
      result = await executor.execute();

      if (result.success) {
        await this.taskManager.updateTaskStatus(taskId, 'completed');
        await this.selfHealer.clearFailures(taskId);
        return result;
      }

      // Try to heal
      const healed = await heal(result.error || 'Unknown error');

      if (!healed) {
        await this.taskManager.updateTaskStatus(taskId, 'failed');
        return result;
      }

      retryCount++;
      result.retryCount = retryCount;

      const canRetry = await this.selfHealer.canRetry(taskId);
      if (!canRetry) {
        await this.taskManager.updateTaskStatus(taskId, 'failed');
        return result;
      }
    }
  }

  async findAndExecuteTask(executor: TaskExecutor): Promise<ExecutionResult | null> {
    const task = await this.taskManager.findRunnableTask();
    if (!task) return null;

    return this.executeTask(task.id, executor);
  }
}
