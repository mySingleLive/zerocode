# ZeroCode - Claude Code Task Management Plugin

## Skills

### zerocode:init
Initialize ZeroCode in the current project.

**Usage:** `/zerocode:init`

Creates the `.zerocode/` directory structure with:
- `tasks/` - Task storage
- `agents/` - Agent storage
- `logs/` - Execution logs
- Pre-configured agents (Product Manager, Tech Lead, Developer)

### zerocode:task-create
Create a new task.

**Usage:** `/zerocode:task-create <name>`

**Options:**
- `-d, --description <text>` - Task description
- `-p, --points <number>` - Task points (default: 3)
- `-D, --depends <ids>` - Comma-separated task IDs this depends on

**Example:** `/zerocode:task-create "Create API" -d "Create REST API endpoints" -p 5`

### zerocode:task-list
List all tasks.

**Usage:** `/zerocode:task-list`

Shows tasks with their status, ID, and name.

### zerocode:task-tree
Show task dependencies as a tree.

**Usage:** `/zerocode:task-tree`

### zerocode:task-show
Show detailed task information.

**Usage:** `/zerocode:task-show <task-id>`

### zerocode:task-abandon
Abandon a task.

**Usage:** `/zerocode:task-abandon <task-id>`

### zerocode:task-execute
Execute a task with self-healing.

**Usage:** `/zerocode:task-execute [task-id]`

If no task ID is provided, automatically selects the next available task.

### zerocode:agent-list
List all agents.

**Usage:** `/zerocode:agent-list`

---

## MCP Tools

When connected via MCP, ZeroCode provides:

- `zerocode_execute_task` - Execute a task with self-healing
- `zerocode_claim_task` - Claim an available task
- `zerocode_create_session` - Create a new session for agent execution
