// src/storage/TaskStorage.ts
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { Task, TaskIndexItem, AcceptanceCriterion } from '../types.js';

export class TaskStorage {
  private baseDir: string;
  private tasksDir: string;
  private indexPath: string;
  private counter: number = 0;

  constructor(baseDir: string = '.zerocode') {
    this.baseDir = baseDir;
    this.tasksDir = path.join(baseDir, 'tasks');
    this.indexPath = path.join(this.tasksDir, 'index.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.tasksDir);
    const exists = await fs.pathExists(this.indexPath);
    if (!exists) {
      await fs.writeJson(this.indexPath, []);
    }
  }

  private async getNextId(): Promise<string> {
    const tasks = await this.listTasks();
    if (tasks.length === 0) {
      this.counter = 0;
    }
    this.counter++;
    return `Task${this.counter}`;
  }

  private async readIndex(): Promise<TaskIndexItem[]> {
    try {
      return await fs.readJson(this.indexPath);
    } catch {
      return [];
    }
  }

  private async writeIndex(index: TaskIndexItem[]): Promise<void> {
    await fs.writeJson(this.indexPath, index, { spaces: 2 });
  }

  async createTask(data: {
    name: string;
    description: string;
    points?: number;
    dependencies?: string[];
    parentId?: string | null;
    acceptanceCriteria?: AcceptanceCriterion[];
  }): Promise<Task> {
    await this.initialize();

    const id = await this.getNextId();
    const now = new Date().toISOString();

    const task: Task = {
      id,
      name: data.name,
      description: data.description,
      status: 'pending',
      dependencies: data.dependencies || [],
      childIds: [],
      parentId: data.parentId || null,
      agentRef: null,
      acceptanceCriteria: data.acceptanceCriteria || [],
      completionConditions: [],
      requirementRef: null,
      points: data.points || 3,
      testCaseRef: null,
      createdAt: now,
      updatedAt: now,
    };

    // Write task markdown file
    const taskPath = path.join(this.tasksDir, `${id}.md`);
    const content = this.taskToMarkdown(task);
    await fs.writeFile(taskPath, content);

    // Update index
    const index = await this.readIndex();
    const indexItem: TaskIndexItem = {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      dependencies: task.dependencies,
      childIds: task.childIds,
      parentId: task.parentId,
      agentRef: task.agentRef,
      points: task.points,
      docRef: `tasks/${id}.md`,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
    index.push(indexItem);
    await this.writeIndex(index);

    // Update parent's childIds
    if (task.parentId) {
      await this.addChildToParent(task.parentId, id);
    }

    return task;
  }

  private taskToMarkdown(task: Task): string {
    const frontmatter = {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      dependencies: task.dependencies,
      childIds: task.childIds,
      parentId: task.parentId,
      agentRef: task.agentRef,
      acceptanceCriteria: task.acceptanceCriteria,
      completionConditions: task.completionConditions,
      requirementRef: task.requirementRef,
      points: task.points,
      testCaseRef: task.testCaseRef,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    const body = `# ${task.name}\n\n## 详细描述\n${task.description}\n`;

    return `---\n${yaml.stringify(frontmatter)}---\n${body}`;
  }

  private async addChildToParent(parentId: string, childId: string): Promise<void> {
    const parent = await this.getTask(parentId);
    if (parent) {
      parent.childIds.push(childId);
      parent.updatedAt = new Date().toISOString();
      await this.updateTask(parent);
    }
  }

  async getTask(id: string): Promise<Task | null> {
    const taskPath = path.join(this.tasksDir, `${id}.md`);
    const exists = await fs.pathExists(taskPath);
    if (!exists) return null;

    const content = await fs.readFile(taskPath, 'utf-8');
    return this.markdownToTask(content);
  }

  private markdownToTask(content: string): Task {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) throw new Error('Invalid task format');

    const frontmatter = yaml.parse(match[1]);
    const body = content.replace(/^---[\s\S]*?---\n/, '');

    return {
      ...frontmatter,
      description: body.replace(/^# .*\n\n## 详细描述\n/, ''),
    } as Task;
  }

  async updateTask(task: Task): Promise<Task> {
    task.updatedAt = new Date().toISOString();
    const taskPath = path.join(this.tasksDir, `${task.id}.md`);
    const content = this.taskToMarkdown(task);
    await fs.writeFile(taskPath, content);

    // Update index
    const index = await this.readIndex();
    const idx = index.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      index[idx] = {
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        dependencies: task.dependencies,
        childIds: task.childIds,
        parentId: task.parentId,
        agentRef: task.agentRef,
        points: task.points,
        docRef: `tasks/${task.id}.md`,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
      await this.writeIndex(index);
    }

    return task;
  }

  async listTasks(): Promise<TaskIndexItem[]> {
    await this.initialize();
    return this.readIndex();
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.getTask(id);
  }

  async deleteTask(id: string): Promise<void> {
    const taskPath = path.join(this.tasksDir, `${id}.md`);
    await fs.remove(taskPath);

    const index = await this.readIndex();
    const newIndex = index.filter(t => t.id !== id);
    await this.writeIndex(newIndex);
  }
}
