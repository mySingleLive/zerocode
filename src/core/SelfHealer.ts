// src/core/SelfHealer.ts
import fs from 'fs-extra';
import path from 'path';
import { FailureLog } from '../types.js';

export class SelfHealer {
  private baseDir: string;
  private logsDir: string;
  private maxRetries: number;

  constructor(baseDir: string = '.zerocode', maxRetries: number = 3) {
    this.baseDir = baseDir;
    this.logsDir = path.join(baseDir, 'logs');
    this.maxRetries = maxRetries;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.logsDir);
  }

  async recordFailure(data: {
    taskId: string;
    error: string;
    rootCause: string;
    fixAttempt: string;
    success: boolean;
  }): Promise<FailureLog> {
    const taskLogDir = path.join(this.logsDir, data.taskId);
    await fs.ensureDir(taskLogDir);

    const failures = await this.getFailures(data.taskId);
    const id = `failure-${failures.length + 1}`;

    const log: FailureLog = {
      id,
      taskId: data.taskId,
      timestamp: new Date().toISOString(),
      error: data.error,
      rootCause: data.rootCause,
      fixAttempt: data.fixAttempt,
      success: data.success,
    };

    const logPath = path.join(taskLogDir, `${id}.json`);
    await fs.writeJson(logPath, log, { spaces: 2 });

    return log;
  }

  async getFailures(taskId: string): Promise<FailureLog[]> {
    const taskLogDir = path.join(this.logsDir, taskId);
    const exists = await fs.pathExists(taskLogDir);
    if (!exists) return [];

    const files = await fs.readdir(taskLogDir);
    const logs: FailureLog[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const logPath = path.join(taskLogDir, file);
        const log = await fs.readJson(logPath);
        logs.push(log);
      }
    }

    return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async canRetry(taskId: string): Promise<boolean> {
    const failures = await this.getFailures(taskId);
    const failedAttempts = failures.filter(f => !f.success).length;
    return failedAttempts < this.maxRetries;
  }

  async getRetryCount(taskId: string): Promise<number> {
    const failures = await this.getFailures(taskId);
    return failures.filter(f => !f.success).length;
  }

  async clearFailures(taskId: string): Promise<void> {
    const taskLogDir = path.join(this.logsDir, taskId);
    await fs.remove(taskLogDir);
  }
}
