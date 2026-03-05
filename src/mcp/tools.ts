// src/mcp/tools.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TaskManager } from '../core/TaskManager.js';
import { AgentManager } from '../core/AgentManager.js';
import { Executor } from '../core/Executor.js';

export function createMCPServer() {
  const server = new Server(
    {
      name: 'zerocode',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const taskManager = new TaskManager();
  const agentManager = new AgentManager();
  const executor = new Executor();

  server.setRequestHandler('tools/list' as any, async () => {
    return {
      tools: [
        {
          name: 'zerocode_execute_task',
          description: 'Execute a task with self-healing',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID to execute' },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'zerocode_claim_task',
          description: 'Claim an available task',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'zerocode_create_session',
          description: 'Create a new session for agent execution',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Agent ID' },
              taskId: { type: 'string', description: 'Task ID' },
            },
            required: ['agentId', 'taskId'],
          },
        },
      ],
    };
  });

  server.setRequestHandler('tools/call' as any, async (request: { params: { name: string; arguments: Record<string, unknown> } }) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'zerocode_execute_task': {
        await taskManager.initialize();
        await executor.initialize();

        const result = await executor.executeTask(args.taskId as string, {
          execute: async () => {
            // Placeholder - actual execution would be done by agent
            return { success: true };
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      }

      case 'zerocode_claim_task': {
        await taskManager.initialize();

        const task = await taskManager.findRunnableTask();
        if (!task) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, message: 'No available tasks' }),
              },
            ],
          };
        }

        await taskManager.updateTaskStatus(task.id, 'processing');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, taskId: task.id, task }),
            },
          ],
        };
      }

      case 'zerocode_create_session': {
        // Placeholder for session creation
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, sessionId: 'session-1' }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
