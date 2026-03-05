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
