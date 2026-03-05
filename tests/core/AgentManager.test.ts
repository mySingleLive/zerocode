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
