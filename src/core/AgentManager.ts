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
