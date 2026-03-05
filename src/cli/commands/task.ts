// src/cli/commands/task.ts
import { Command } from 'commander';
import { TaskManager } from '../../core/TaskManager.js';
import { AgentManager } from '../../core/AgentManager.js';
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

taskCommands
  .command('init')
  .description('Initialize ZeroCode in current project')
  .action(async () => {
    const taskManager = new TaskManager();
    const agentManager = new AgentManager();

    await taskManager.initialize();
    await agentManager.initialize();

    console.log(chalk.green('Creating default agents...'));

    // Create Product Manager
    await agentManager.createAgent({
      name: '林若曦',
      role: '产品经理',
      personality: '经验丰富，擅长分析需求，注重用户体验',
      expertise: ['需求分析', '头脑风暴', '文档编写'],
    });

    // Create Tech Lead
    await agentManager.createAgent({
      name: '张伟',
      role: '技术经理',
      personality: '技术功底扎实，善于架构设计和项目管理',
      expertise: ['项目管理', '技术设计', '任务拆解'],
    });

    // Create Developer
    await agentManager.createAgent({
      name: '李明',
      role: '程序员',
      personality: '代码能力扎实，善于解决技术难题',
      expertise: ['编程', '调试', '重构'],
    });

    console.log(chalk.green('\nZeroCode initialized successfully!'));
    console.log(chalk.cyan('\nDefault agents created:'));
    console.log('  - Agent1: 林若曦 (产品经理)');
    console.log('  - Agent2: 张伟 (技术经理)');
    console.log('  - Agent3: 李明 (程序员)');
    console.log();
  });
