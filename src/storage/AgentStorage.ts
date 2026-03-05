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
