#!/usr/bin/env node

import { Command } from 'commander';
import { taskCommands } from './commands/task.js';

const program = new Command();

program
  .name('zerocode')
  .description('Claude Code task management and execution plugin')
  .version('1.0.0');

program.addCommand(taskCommands);

program.parse();
