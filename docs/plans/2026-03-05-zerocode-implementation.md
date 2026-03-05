# ZeroCode MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build ZeroCode MVP - a Claude Code task management and execution plugin with self-healing capabilities

**Architecture:** Node.js + TypeScript CLI with MCP server. Tasks stored as Markdown + YAML Frontmatter with JSON index files. Self-healing engine handles failure analysis and retry.

**Tech Stack:** Node.js, TypeScript, Commander.js, @modelcontextprotocol/server, fs-extra, yaml

---

## Phase 1: Project Setup

### Task 1: Initialize Node.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "zerocode",
  "version": "1.0.0",
  "description": "Claude Code task management and execution plugin with self-healing",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "zerocode": "dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "keywords": ["claude", "task-management", "agent", "self-healing"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/server": "^0.5.0",
    "commander": "^11.1.0",
    "fs-extra": "^11.2.0",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Install dependencies**

```bash
npm install
```

**Step 4: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore: initialize Node.js project with TypeScript"
```

---

### Task 2: Create Project Structure

**Files:**
- Create: `src/index.ts`
- Create: `src/types.ts`
- Create: `src/storage/index.ts`

**Step 1: Create src/types.ts**

```typescript
// Task status enum
export type TaskStatus = 'pending' | 'waiting_dep' | 'processing' | 'testing' | 'completed' | 'failed' | 'abandoned';

// Task acceptance criteria
export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

// Task model
export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  childIds: string[];
  parentId: string | null;
  agentRef: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  completionConditions: string[];
  requirementRef: string | null;
  points: number;
  testCaseRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// Task index item (lightweight)
export interface TaskIndexItem {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  childIds: string[];
  parentId: string | null;
  agentRef: string | null;
  points: number;
  docRef: string;
  createdAt: string;
  updatedAt: string;
}

// Agent model
export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  expertise: string[];
  assignedTasks: string[];
  createdAt: string;
  updatedAt: string;
}

// Agent index item
export interface AgentIndexItem {
  id: string;
  name: string;
  role: string;
  assignedTasks: string[];
  docRef: string;
  createdAt: string;
  updatedAt: string;
}

// Failure log entry
export interface FailureLog {
  id: string;
  taskId: string;
  timestamp: string;
  error: string;
  rootCause: string;
  fixAttempt: string;
  success: boolean;
}
```

**Step 2: Create src/storage/index.ts**

```typescript
// Storage utilities - placeholder for now
export const ZEROCODE_DIR = '.zerocode';
export const TASKS_DIR = `${ZEROCODE_DIR}/tasks`;
export const AGENTS_DIR = `${ZEROCODE_DIR}/agents`;
export const LOGS_DIR = `${ZEROCODE_DIR}/logs`;
```

**Step 3: Create src/index.ts**

```typescript
// Main entry point
export * from './types.js';
export * from './storage/index.js';
```

**Step 4: Build and verify**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: create project structure and types"
```

---

## Phase 2: Storage Layer

### Task 3: Task Storage

**Files:**
- Create: `src/storage/TaskStorage.ts`
- Create: `tests/storage/TaskStorage.test.ts`

**Step 1: Write failing test**

```typescript
// tests/storage/TaskStorage.test.ts
import { TaskStorage } from '../../src/storage/TaskStorage.js';
import fs from 'fs-extra';
import path from 'path';

describe('TaskStorage', () => {
  const testDir = './test-zerocode';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should initialize task directory', async () => {
    const storage = new TaskStorage(testDir);
    await storage.initialize();
    const exists = await fs.pathExists(path.join(testDir, 'tasks'));
    expect(exists).toBe(true);
  });

  test('should create task and update index', async () => {
    const storage = new TaskStorage(testDir);
    await storage.initialize();

    const task = await storage.createTask({
      name: 'Test Task',
      description: 'Test description',
      points: 3,
    });

    expect(task.id).toBe('Task1');
    expect(task.status).toBe('pending');

    const tasks = await storage.listTasks();
    expect(tasks).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/storage/TaskStorage.test.ts
# Expected: FAIL - cannot find module
```

**Step 3: Implement TaskStorage**

```typescript
// src/storage/TaskStorage.ts
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { Task, TaskIndexItem, TaskStatus, AcceptanceCriterion } from '../types.js';

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
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/storage/TaskStorage.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/storage/TaskStorage.ts tests/storage/TaskStorage.test.ts
git commit -m "feat: implement TaskStorage with markdown and JSON index"
```

---

### Task 4: Agent Storage

**Files:**
- Create: `src/storage/AgentStorage.ts`
- Create: `tests/storage/AgentStorage.test.ts`

**Step 1: Write failing test**

```typescript
// tests/storage/AgentStorage.test.ts
import { AgentStorage } from '../../src/storage/AgentStorage.js';
import fs from 'fs-extra';
import path from 'path';

describe('AgentStorage', () => {
  const testDir = './test-zerocode';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should initialize agent directory', async () => {
    const storage = new AgentStorage(testDir);
    await storage.initialize();
    const exists = await fs.pathExists(path.join(testDir, 'agents'));
    expect(exists).toBe(true);
  });

  test('should create agent', async () => {
    const storage = new AgentStorage(testDir);
    await storage.initialize();

    const agent = await storage.createAgent({
      name: 'Test Agent',
      role: 'Developer',
      personality: 'Test personality',
      expertise: ['TypeScript'],
    });

    expect(agent.id).toBe('Agent1');
    expect(agent.name).toBe('Test Agent');

    const agents = await storage.listAgents();
    expect(agents).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/storage/AgentStorage.test.ts
# Expected: FAIL
```

**Step 3: Implement AgentStorage**

```typescript
// src/storage/AgentStorage.ts
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { Agent, AgentIndexItem } from '../types.js';

export class AgentStorage {
  private baseDir: string;
  private agentsDir: string;
  private indexPath: string;
  private counter: number = 0;

  constructor(baseDir: string = '.zerocode') {
    this.baseDir = baseDir;
    this.agentsDir = path.join(baseDir, 'agents');
    this.indexPath = path.join(this.agentsDir, 'index.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.agentsDir);
    const exists = await fs.pathExists(this.indexPath);
    if (!exists) {
      await fs.writeJson(this.indexPath, []);
    }
  }

  private async getNextId(): Promise<string> {
    const agents = await this.listAgents();
    if (agents.length === 0) {
      this.counter = 0;
    }
    this.counter++;
    return `Agent${this.counter}`;
  }

  private async readIndex(): Promise<AgentIndexItem[]> {
    try {
      return await fs.readJson(this.indexPath);
    } catch {
      return [];
    }
  }

  private async writeIndex(index: AgentIndexItem[]): Promise<void> {
    await fs.writeJson(this.indexPath, index, { spaces: 2 });
  }

  async createAgent(data: {
    name: string;
    role: string;
    personality: string;
    expertise: string[];
  }): Promise<Agent> {
    await this.initialize();

    const id = await this.getNextId();
    const now = new Date().toISOString();

    const agent: Agent = {
      id,
      name: data.name,
      role: data.role,
      personality: data.personality,
      expertise: data.expertise,
      assignedTasks: [],
      createdAt: now,
      updatedAt: now,
    };

    // Write agent markdown file
    const agentPath = path.join(this.agentsDir, `${id}.md`);
    const content = this.agentToMarkdown(agent);
    await fs.writeFile(agentPath, content);

    // Update index
    const index = await this.readIndex();
    const indexItem: AgentIndexItem = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      assignedTasks: agent.assignedTasks,
      docRef: `agents/${id}.md`,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
    index.push(indexItem);
    await this.writeIndex(index);

    return agent;
  }

  private agentToMarkdown(agent: Agent): string {
    const frontmatter = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      personality: agent.personality,
      expertise: agent.expertise,
      assignedTasks: agent.assignedTasks,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };

    const body = `# ${agent.name} - ${agent.role}\n\n## 个人简介\n${agent.personality}\n\n## 专业能力\n${agent.expertise.map(e => `- ${e}`).join('\n')}\n`;

    return `---\n${yaml.stringify(frontmatter)}---\n${body}`;
  }

  async getAgent(id: string): Promise<Agent | null> {
    const agentPath = path.join(this.agentsDir, `${id}.md`);
    const exists = await fs.pathExists(agentPath);
    if (!exists) return null;

    const content = await fs.readFile(agentPath, 'utf-8');
    return this.markdownToAgent(content);
  }

  private markdownToAgent(content: string): Agent {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) throw new Error('Invalid agent format');

    const frontmatter = yaml.parse(match[1]);
    const body = content.replace(/^---[\s\S]*?---\n/, '');

    return {
      ...frontmatter,
      personality: body.match(/## 个人简介\n([\s\S]*?)\n\n/)?.[1] || '',
      expertise: body.match(/## 专业能力\n([\s\S]*?)$/)?.[1]?.split('\n').filter(Boolean).map(s => s.replace('- ', '')) || [],
    } as Agent;
  }

  async updateAgent(agent: Agent): Promise<Agent> {
    agent.updatedAt = new Date().toISOString();
    const agentPath = path.join(this.agentsDir, `${agent.id}.md`);
    const content = this.agentToMarkdown(agent);
    await fs.writeFile(agentPath, content);

    const index = await this.readIndex();
    const idx = index.findIndex(a => a.id === agent.id);
    if (idx !== -1) {
      index[idx] = {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        assignedTasks: agent.assignedTasks,
        docRef: `agents/${agent.id}.md`,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      };
      await this.writeIndex(index);
    }

    return agent;
  }

  async listAgents(): Promise<AgentIndexItem[]> {
    await this.initialize();
    return this.readIndex();
  }

  async getAgentById(id: string): Promise<Agent | null> {
    return this.getAgent(id);
  }

  async deleteAgent(id: string): Promise<void> {
    const agentPath = path.join(this.agentsDir, `${id}.md`);
    await fs.remove(agentPath);

    const index = await this.readIndex();
    const newIndex = index.filter(a => a.id !== id);
    await this.writeIndex(newIndex);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/storage/AgentStorage.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/storage/AgentStorage.ts tests/storage/AgentStorage.test.ts
git commit -m "feat: implement AgentStorage with markdown and JSON index"
```

---

## Phase 3: Core Components

### Task 5: Task Manager

**Files:**
- Create: `src/core/TaskManager.ts`
- Create: `tests/core/TaskManager.test.ts`

**Step 1: Write failing test**

```typescript
// tests/core/TaskManager.test.ts
import { TaskManager } from '../../src/core/TaskManager.js';
import fs from 'fs-extra';

describe('TaskManager', () => {
  const testDir = './test-zerocode';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should create task', async () => {
    const manager = new TaskManager(testDir);
    await manager.initialize();

    const task = await manager.createTask({
      name: 'Test Task',
      description: 'Test description',
    });

    expect(task.id).toBe('Task1');
    expect(task.status).toBe('pending');
  });

  test('should list tasks', async () => {
    const manager = new TaskManager(testDir);
    await manager.initialize();

    await manager.createTask({ name: 'Task 1', description: 'Desc 1' });
    await manager.createTask({ name: 'Task 2', description: 'Desc 2' });

    const tasks = await manager.listTasks();
    expect(tasks).toHaveLength(2);
  });

  test('should get pending tasks', async () => {
    const manager = new TaskManager(testDir);
    await manager.initialize();

    const task1 = await manager.createTask({ name: 'Task 1', description: 'Desc 1' });
    await manager.updateTaskStatus(task1.id, 'completed');
    await manager.createTask({ name: 'Task 2', description: 'Desc 2' });

    const pending = await manager.getPendingTasks();
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe('Task 2');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/core/TaskManager.test.ts
# Expected: FAIL
```

**Step 3: Implement TaskManager**

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/core/TaskManager.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/core/TaskManager.ts tests/core/TaskManager.test.ts
git commit -m "feat: implement TaskManager"
```

---

### Task 6: Agent Manager

**Files:**
- Create: `src/core/AgentManager.ts`
- Create: `tests/core/AgentManager.test.ts`

**Step 1: Write failing test**

```typescript
// tests/core/AgentManager.test.ts
import { AgentManager } from '../../src/core/AgentManager.js';
import fs from 'fs-extra';

describe('AgentManager', () => {
  const testDir = './test-zerocode';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should create agent', async () => {
    const manager = new AgentManager(testDir);
    await manager.initialize();

    const agent = await manager.createAgent({
      name: 'Test Agent',
      role: 'Developer',
      personality: 'Test personality',
      expertise: ['TypeScript'],
    });

    expect(agent.id).toBe('Agent1');
  });

  test('should list agents', async () => {
    const manager = new AgentManager(testDir);
    await manager.initialize();

    await manager.createAgent({
      name: 'Agent 1',
      role: 'Developer',
      personality: 'Personality 1',
      expertise: ['TypeScript'],
    });

    const agents = await manager.listAgents();
    expect(agents).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/core/AgentManager.test.ts
# Expected: FAIL
```

**Step 3: Implement AgentManager**

```typescript
// src/core/AgentManager.ts
import { AgentStorage } from '../storage/AgentStorage.js';
import { Agent, AgentIndexItem } from '../types.js';

export class AgentManager {
  private storage: AgentStorage;

  constructor(baseDir: string = '.zerocode') {
    this.storage = new AgentStorage(baseDir);
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  async createAgent(data: {
    name: string;
    role: string;
    personality: string;
    expertise: string[];
  }): Promise<Agent> {
    return this.storage.createAgent(data);
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.storage.getAgent(id);
  }

  async updateAgent(agent: Agent): Promise<Agent> {
    return this.storage.updateAgent(agent);
  }

  async listAgents(): Promise<AgentIndexItem[]> {
    return this.storage.listAgents();
  }

  async getAgentById(id: string): Promise<Agent | null> {
    return this.storage.getAgentById(id);
  }

  async deleteAgent(id: string): Promise<void> {
    return this.storage.deleteAgent(id);
  }

  async assignTask(agentId: string, taskId: string): Promise<Agent | null> {
    const agent = await this.storage.getAgent(agentId);
    if (!agent) return null;

    if (!agent.assignedTasks.includes(taskId)) {
      agent.assignedTasks.push(taskId);
      return this.storage.updateAgent(agent);
    }
    return agent;
  }

  async findAvailableAgent(taskType?: string): Promise<Agent | null> {
    const agents = await this.listAgents();
    if (agents.length === 0) return null;

    // Default: return first available agent
    // In future: match by task type and agent expertise
    return this.storage.getAgent(agents[0].id);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/core/AgentManager.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/core/AgentManager.ts tests/core/AgentManager.test.ts
git commit -m "feat: implement AgentManager"
```

---

### Task 7: Self-Healing Engine

**Files:**
- Create: `src/core/SelfHealer.ts`
- Create: `tests/core/SelfHealer.test.ts`

**Step 1: Write failing test**

```typescript
// tests/core/SelfHealer.test.ts
import { SelfHealer } from '../../src/core/SelfHealer.js';
import fs from 'fs-extra';

describe('SelfHealer', () => {
  const testDir = './test-zerocode';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should record failure', async () => {
    const healer = new SelfHealer(testDir);
    await healer.initialize();

    await healer.recordFailure({
      taskId: 'Task1',
      error: 'Test error',
      rootCause: 'Test root cause',
      fixAttempt: 'Test fix',
      success: false,
    });

    const failures = await healer.getFailures('Task1');
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe('Test error');
  });

  test('should check if max retries reached', async () => {
    const healer = new SelfHealer(testDir, 3);
    await healer.initialize();

    for (let i = 0; i < 3; i++) {
      await healer.recordFailure({
        taskId: 'Task1',
        error: 'Error ' + i,
        rootCause: 'Root cause',
        fixAttempt: 'Fix',
        success: false,
      });
    }

    const canRetry = await healer.canRetry('Task1');
    expect(canRetry).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/core/SelfHealer.test.ts
# Expected: FAIL
```

**Step 3: Implement SelfHealer**

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/core/SelfHealer.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/core/SelfHealer.ts tests/core/SelfHealer.test.ts
git commit -m "feat: implement SelfHealer for failure tracking"
```

---

### Task 8: Executor

**Files:**
- Create: `src/core/Executor.ts`
- Create: `tests/core/Executor.test.ts`

**Step 1: Write failing test**

```typescript
// tests/core/Executor.test.ts
import { Executor } from '../../src/core/Executor.js';
import fs from 'fs-extra';

describe('Executor', () => {
  const testDir = './test-zerocode';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should execute task with mock', async () => {
    const executor = new Executor(testDir);
    await executor.initialize();

    // Mock the task execution
    const result = await executor.executeTask('Task1', {
      execute: async () => ({ success: true }),
    });

    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/core/Executor.test.ts
# Expected: FAIL
```

**Step 3: Implement Executor**

```typescript
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
        await selfHealer.clearFailures(taskId);
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
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/core/Executor.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/core/Executor.ts tests/core/Executor.test.ts
git commit -m "feat: implement Executor with self-healing"
```

---

## Phase 4: CLI Commands

### Task 9: CLI Commands

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/commands/task.ts`

**Step 1: Create CLI entry point**

```typescript
// src/cli/index.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { taskCommands } from './commands/task.js';

const program = new Command();

program
  .name('zerocode')
  .description('Claude Code task management and execution plugin')
  .version('1.0.0');

program.addCommand(taskCommands);

program.parse();
```

**Step 2: Create task commands**

```typescript
// src/cli/commands/task.ts
import { Command } from 'commander';
import { TaskManager } from '../../core/TaskManager.js';
import chalk from 'chalk';

export const taskCommands = new Command('task');

taskCommands
  .description('Manage tasks')
  .action(() => {
    taskCommands.help();
  });

taskCommands
  .command('create')
  .description('Create a new task')
  .argument('<name>', 'Task name')
  .option('-d, --description <description>', 'Task description')
  .option('-p, --points <points>', 'Task points', '3')
  .action(async (name, options) => {
    const manager = new TaskManager();
    await manager.initialize();

    const task = await manager.createTask({
      name,
      description: options.description || name,
      points: parseInt(options.points),
    });

    console.log(chalk.green(`Task created: ${task.id} - ${task.name}`));
  });

taskCommands
  .command('list')
  .description('List all tasks')
  .action(async () => {
    const manager = new TaskManager();
    await manager.initialize();

    const tasks = await manager.listTasks();

    if (tasks.length === 0) {
      console.log('No tasks found.');
      return;
    }

    console.log(chalk.bold('\nTasks:\n'));
    for (const task of tasks) {
      const statusColor = {
        pending: chalk.yellow,
        waiting_dep: chalk.gray,
        processing: chalk.blue,
        testing: chalk.cyan,
        completed: chalk.green,
        failed: chalk.red,
        abandoned: chalk.dim,
      }[task.status] || chalk.white;

      console.log(`  ${task.id} | ${statusColor(task.status.padEnd(12))} | ${task.name}`);
    }
    console.log();
  });

taskCommands
  .command('show')
  .description('Show task details')
  .argument('<id>', 'Task ID')
  .action(async (id) => {
    const manager = new TaskManager();
    await manager.initialize();

    const task = await manager.getTask(id);

    if (!task) {
      console.log(chalk.red(`Task not found: ${id}`));
      return;
    }

    console.log(chalk.bold(`\n${task.id}: ${task.name}\n`));
    console.log(`Status: ${task.status}`);
    console.log(`Points: ${task.points}`);
    console.log(`Description: ${task.description}`);
    console.log(`Dependencies: ${task.dependencies.join(', ') || 'None'}`);
    console.log(`Created: ${task.createdAt}`);
    console.log();
  });
```

**Step 3: Build and test**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/cli/
git commit -m "feat: implement CLI commands"
```

---

## Phase 5: MCP Server

### Task 10: MCP Server

**Files:**
- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools.ts`

**Step 1: Create MCP tools**

```typescript
// src/mcp/tools.ts
import { Server } from '@modelcontextprotocol/server';
import { TaskManager } from '../core/TaskManager.js';
import { AgentManager } from '../core/AgentManager.js';
import { Executor } from '../core/Executor.js';

export function createMCPServer() {
  const server = new Server(
    {
      name: 'zerocode',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const taskManager = new TaskManager();
  const agentManager = new AgentManager();
  const executor = new Executor();

  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [
        {
          name: 'zerocode_execute_task',
          description: 'Execute a task with self-healing',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID to execute' },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'zerocode_claim_task',
          description: 'Claim an available task',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'zerocode_create_session',
          description: 'Create a new session for agent execution',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent ID' },
              taskId: { type: 'string', description: 'Task ID' },
            },
            required: ['agentId', 'taskId'],
          },
        },
      ],
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'zerocode_execute_task': {
        await taskManager.initialize();
        await executor.initialize();

        const result = await executor.executeTask(args.taskId, {
          execute: async () => {
            // Placeholder - actual execution would be done by agent
            return { success: true };
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'zerocode_claim_task': {
        await taskManager.initialize();

        const task = await taskManager.findRunnableTask();
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, message: 'No available tasks' }),
              },
            ],
          };
        }

        await taskManager.updateTaskStatus(task.id, 'processing');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, taskId: task.id, task }),
            },
          ],
        };
      }

      case 'zerocode_create_session': {
        // Placeholder for session creation
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, sessionId: 'session-1' }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
```

**Step 2: Create server entry**

```typescript
// src/mcp/server.ts
import { createMCPServer } from './tools.js';

const server = createMCPServer();

server.connect();
```

**Step 3: Build and commit**

```bash
npm run build
git add src/mcp/
git commit -m "feat: implement MCP server"
```

---

## Phase 6: Skills

### Task 11: Create Skill Definition

**Files:**
- Create: `zerocode.md`

**Step 1: Create zerocode.md**

```markdown
# ZeroCode - Claude Code Task Management Plugin

## Skills

### zerocode:init
Initialize ZeroCode in the current project.

**Usage:** `/zerocode:init`

Creates the `.zerocode/` directory structure with:
- `tasks/` - Task storage
- `agents/` - Agent storage
- `logs/` - Execution logs
- Pre-configured agents (Product Manager, Tech Lead, Developer)

### zerocode:task-create
Create a new task.

**Usage:** `/zerocode:task-create <name>`

**Options:**
- `-d, --description <text>` - Task description
- `-p, --points <number>` - Task points (default: 3)
- `-D, --depends <ids>` - Comma-separated task IDs this depends on

**Example:** `/zerocode:task-create "Create API" -d "Create REST API endpoints" -p 5`

### zerocode:task-list
List all tasks.

**Usage:** `/zerocode:task-list`

Shows tasks with their status, ID, and name.

### zerocode:task-tree
Show task dependencies as a tree.

**Usage:** `/zerocode:task-tree`

### zerocode:task-show
Show detailed task information.

**Usage:** `/zerocode:task-show <task-id>`

### zerocode:task-abandon
Abandon a task.

**Usage:** `/zerocode:task-abandon <task-id>`

### zerocode:task-execute
Execute a task with self-healing.

**Usage:** `/zerocode:task-execute [task-id]`

If no task ID is provided, automatically selects the next available task.

### zerocode:agent-list
List all agents.

**Usage:** `/zerocode:agent-list`

---

## MCP Tools

When connected via MCP, ZeroCode provides:

- `zerocode_execute_task` - Execute a task with self-healing
- `zerocode_claim_task` - Claim an available task
- `zerocode_create_session` - Create a new session for agent execution
```

**Step 2: Commit**

```bash
git add zerocode.md
git commit -m "feat: add ZeroCode skill definition"
```

---

## Phase 7: Initialization

### Task 12: Init Command with Default Agents

**Files:**
- Modify: `src/cli/commands/task.ts`

**Step 1: Add init command**

```typescript
// Add to src/cli/commands/task.ts

taskCommands
  .command('init')
  .description('Initialize ZeroCode in current project')
  .action(async () => {
    const taskManager = new TaskManager();
    const agentManager = new AgentManager();

    await taskManager.initialize();
    await agentManager.initialize();

    console.log(chalk.green('Creating default agents...'));

    // Create Product Manager
    await agentManager.createAgent({
      name: '林若曦',
      role: '产品经理',
      personality: '经验丰富，擅长分析需求，注重用户体验',
      expertise: ['需求分析', '头脑风暴', '文档编写'],
    });

    // Create Tech Lead
    await agentManager.createAgent({
      name: '张伟',
      role: '技术经理',
      personality: '技术功底扎实，善于架构设计和项目管理',
      expertise: ['项目管理', '技术设计', '任务拆解'],
    });

    // Create Developer
    await agentManager.createAgent({
      name: '李明',
      role: '程序员',
      personality: '代码能力扎实，善于解决技术难题',
      expertise: ['编程', '调试', '重构'],
    });

    console.log(chalk.green('\nZeroCode initialized successfully!'));
    console.log(chalk.cyan('\nDefault agents created:'));
    console.log('  - Agent1: 林若曦 (产品经理)');
    console.log('  - Agent2: 张伟 (技术经理)');
    console.log('  - Agent3: 李明 (程序员)');
    console.log();
  });
```

**Step 2: Build and commit**

```bash
npm run build
git add src/cli/
git commit -m "feat: add init command with default agents"
```

---

## Plan Complete

Plan complete and saved to `docs/plans/2026-03-05-zerocode-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
