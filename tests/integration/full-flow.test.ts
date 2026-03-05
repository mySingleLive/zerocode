// tests/integration/full-flow.test.ts
import { TaskManager } from '../../src/core/TaskManager.js';
import { AgentManager } from '../../src/core/AgentManager.js';
import { Executor } from '../../src/core/Executor.js';
import fs from 'fs-extra';

describe('Full Flow Integration', () => {
  const testDir = './test-zerocode-integration';

  beforeEach(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  test('should complete full workflow: init -> create task -> execute', async () => {
    // Step 1: Initialize (create agents)
    const agentManager = new AgentManager(testDir);
    await agentManager.initialize();

    const pm = await agentManager.createAgent({
      name: 'Product Manager',
      role: 'PM',
      personality: 'Test',
      expertise: ['requirements'],
    });

    const dev = await agentManager.createAgent({
      name: 'Developer',
      role: 'Dev',
      personality: 'Test',
      expertise: ['coding'],
    });

    expect(pm.id).toBe('Agent1');
    expect(dev.id).toBe('Agent2');

    // Step 2: Create task
    const taskManager = new TaskManager(testDir);
    await taskManager.initialize();

    const task = await taskManager.createTask({
      name: 'Integration Test Task',
      description: 'Testing full workflow',
      points: 3,
    });

    expect(task.id).toBe('Task1');
    expect(task.status).toBe('pending');

    // Step 3: Execute task with executor
    const executor = new Executor(testDir);
    await executor.initialize();

    const result = await executor.executeTask(task.id, {
      execute: async () => {
        return { success: true };
      },
    });

    expect(result.success).toBe(true);

    // Step 4: Verify task status changed to completed
    const updatedTask = await taskManager.getTask(task.id);
    expect(updatedTask?.status).toBe('completed');

    // Step 5: List tasks and verify
    const tasks = await taskManager.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('completed');
  });

  test('should handle task failure and healing', async () => {
    const taskManager = new TaskManager(testDir);
    await taskManager.initialize();

    const task = await taskManager.createTask({
      name: 'Failing Task',
      description: 'Will fail once',
      points: 2,
    });

    const executor = new Executor(testDir, 3);
    await executor.initialize();

    // First execution fails
    const result1 = await executor.executeTask(task.id, {
      execute: async () => {
        return { success: false, error: 'Test error' };
      },
    });

    expect(result1.success).toBe(false);
    expect(result1.retryCount).toBe(1);

    // Task should be marked as failed after exhausting retries
    const updatedTask = await taskManager.getTask(task.id);
    expect(updatedTask?.status).toBe('failed');
  });

  test('should assign agent to task', async () => {
    const agentManager = new AgentManager(testDir);
    await agentManager.initialize();

    const agent = await agentManager.createAgent({
      name: 'Dev Agent',
      role: 'Developer',
      personality: 'Test',
      expertise: ['coding'],
    });

    const taskManager = new TaskManager(testDir);
    await taskManager.initialize();

    const task = await taskManager.createTask({
      name: 'Assigned Task',
      description: 'Task with agent',
      points: 5,
    });

    // Assign agent to task (updates task)
    await taskManager.assignAgent(task.id, agent.id);

    // Also update agent's assignedTasks
    await agentManager.assignTask(agent.id, task.id);

    // Verify task has agentRef
    const updatedTask = await taskManager.getTask(task.id);
    expect(updatedTask?.agentRef).toBe(agent.id);

    // Agent should have the task in assignedTasks
    const updatedAgent = await agentManager.getAgent(agent.id);
    expect(updatedAgent?.assignedTasks).toContain(task.id);
  });
});
