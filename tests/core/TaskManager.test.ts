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
