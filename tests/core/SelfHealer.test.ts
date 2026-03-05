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
