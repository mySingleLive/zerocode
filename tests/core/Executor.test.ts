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
