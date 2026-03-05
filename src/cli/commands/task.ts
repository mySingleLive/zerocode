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
      const statusColor: Record<string, (s: string) => string> = {
        pending: chalk.yellow,
        waiting_dep: chalk.gray,
        processing: chalk.blue,
        testing: chalk.cyan,
        completed: chalk.green,
        failed: chalk.red,
        abandoned: chalk.dim,
      };

      console.log(`  ${task.id} | ${(statusColor[task.status] || chalk.white)(task.status.padEnd(12))} | ${task.name}`);
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
