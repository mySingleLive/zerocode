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
