# ZeroCode MVP 设计文档

**日期**: 2026-03-05

---

## 1. 项目概述

ZeroCode MVP 是一个 Claude Code 任务管理与执行插件，核心特性是**自愈执行** - 任务失败后自动分析问题、生成修复方案、执行修复，直到成功或达到重试上限。

**MVP 包含**:
- 任务管理（创建、查看、列表、树形显示、废弃）
- 任务执行（依赖解析、自动领取、TDD、测试执行、完成条件检查）
- 完整自愈循环（失败日志、根因分析、修复方案、执行修复、用户介入判断）
- 预制子代理（3 个角色）

**MVP 不包含**:
- 需求管理
- 长期记忆系统
- 反思能力
- Web 界面
- 文件变更钩子

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────┐
│              ZeroCode CLI                    │
├─────────────────────────────────────────────┤
│  ┌─────────┐              ┌─────────┐     │
│  │  Task   │              │  Agent  │     │
│  │ Manager │              │ Manager │     │
│  └────┬────┘              └────┬────┘     │
│       └───────────┬──────────────┘          │
│  ┌────────────────┴────────────────┐        │
│  │       Executor (自愈引擎)       │        │
│  │  • 依赖分析  • TDD  • 执行    │        │
│  │  • 测试  • 完成条件检查        │        │
│  │  • 根因分析  • 修复循环        │        │
│  └────────────────┬────────────────┘        │
│  ┌────────────────┴────────────────┐        │
│  │        Storage Layer             │        │
│  │  • Markdown + YAML Frontmatter  │        │
│  │  • JSON (索引文件)              │        │
│  └─────────────────────────────────┘        │
│  ┌─────────────────────────────────┐        │
│  │        MCP Server (按需)         │        │
│  └─────────────────────────────────┘        │
└─────────────────────────────────────────────┘
```

### 2.2 数据存储

- **位置**: `.zerocode/` 目录（项目内）
- **格式**: Markdown + YAML Frontmatter + JSON
  - Task (`.zerocode/tasks/Task1.md`)
  - Agent (`.zerocode/agents/Agent1.md`)
  - 索引 (`.zerocode/tasks/index.json`, `.zerocode/agents/index.json`)

---

## 3. 核心执行流程

```
开始执行
    │
    ├─► 选择任务 ──► 自动领取机制
    │               └─► 递归找到最小可执行任务
    │
    ├─► 分配子代理 ──► 根据角色选择子代理
    │               └─► 记录 agentRef
    │
    ├─► 检查依赖 ──► 递归执行依赖任务（可并行）
    │               └─► 依赖任务成功后返回
    │
    ├─► 检查子任务 ──► 递归执行所有子任务（可并行）
    │                   └─► 所有子任务成功后返回
    │
    ├─► TDD: 生成验收测试用例
    │
    ├─► 执行任务（调用 Skill）
    │
    ├─► 状态 → testing ──► 运行测试
    │           ├─► 失败 → 自愈循环
    │           └─► 通过 → 检查完成条件
    │
    ├─► 检查完成条件
    │     ├─► 不满足 → 修复 → 重检 (循环)
    │     └─► 满足 → 状态 → completed
    │
    └─► 继续下一个任务（或并行执行无依赖任务）
```

### 3.1 任务自动领取

```
领取任务
    │
    ├─► 扫描所有非 completed、非 abandoned 的任务
    │
    ├─► 寻找第一个 waiting_dep 或 pending 的任务
    │
    ├─► 递归查找最小任务
    │     │
    │     ├─► 该任务有依赖? ──► 顺着依赖链找到最底层未完成的任务
    │     │                     └─► 返回该依赖任务
    │     │
    │     └─► 该任务有子任务? ──► 顺着子任务链找到最底层未完成的任务
    │                             └─► 返回该子任务
    │
    ├─► 分配子代理 ──► 根据策略选择子代理
    │               └─► 记录 agentRef
    │
    └─► 领取该任务 (状态 → processing)
```

**优先级**:
1. waiting_dep 状态的任务优先
2. pending 状态的任务次之

### 3.2 任务自动拆解

```
拆解任务
    │
    ├─► 预估点数 ──► 点数 > 5?
    │               ├─► 是 ──► 拆解为多个子任务
    │               │           ├─► 子任务1 (预估点数)
    │               │           ├─► 子任务2 (预估点数)
    │               │           └─► ...
    │               │
    │               └─► 否 ──► 停止拆解
    │
    └─► 递归检查每个子任务
          └─► 点数 > 5? ──► 继续拆解，直到点数 <= 5
```

**拆解规则**:
- 点数 > 5：将任务拆解为 2-5 个子任务
- 子任务递归进行拆解检查，直到所有叶子任务点数 <= 5
- 拆解时建立 parentId 和 childIds 关联

### 3.3 自愈循环

```
任务失败
    │
    ▼
┌───────────────────────┐
│ 1. 记录失败日志        │
│ 2. 根因分析 (LLM)     │
│ 3. 生成修复方案       │
│ 4. 执行修复           │
└───────────────────────┘
    │
    ▼
┌───────────────────────┐
│ 检查: 用户介入         │
│ (权限问题、人工授权等) │
└───────────────────────┘
    │ 是
    ▼
┌───────────────────────┐
│ 询问用户              │
├─► 用户授权/回答 ──► 继续执行
├─► 用户拒绝 ──► 停止，标记 failed
└───────────────────────┘
    │ 否
    ▼
┌───────────────────────┐
│ 检查: 是否达到最大重试 │──是──► 标记为 failed，记录原因
│        或无法继续？    │
└───────────────────────┘
    │ 否
    ▼
┌───────────────────────┐
│ 重试 (回到执行步骤)    │
└───────────────────────┘
```

**退出条件**:
- 任务完成
- 达到最大重试次数
- 用户拒绝继续

**失败日志存储**:
- 位置: `.zerocode/logs/Task1/`
- 包含: 错误信息、根因分析、修复尝试记录

---

## 4. 数据模型

### 4.1 Task

文件位置：`.zerocode/tasks/Task1.md`

```markdown
---
id: Task1
name: 创建项目结构
description: 创建基础的目录结构
status: pending
dependencies: []
childIds: []
parentId: null
agentRef: null
acceptanceCriteria:
  - given: 项目根目录
    when: 执行初始化命令
    then: 生成 src/、data/ 等目录
completionConditions: []
requirementRef: null
points: 3
testCaseRef: null
createdAt: 2026-03-05T10:00:00Z
updatedAt: 2026-03-05T10:00:00Z
---

# 创建项目结构

## 详细描述
需要创建以下目录结构：
- src/ - 源代码目录
- data/ - 数据目录
- tests/ - 测试目录

## 实现步骤
1. 使用 mkdir 创建目录
2. 添加 .gitkeep 文件
3. 验证目录创建成功
```

### 4.2 任务索引文件

文件位置：`.zerocode/tasks/index.json`

```json
[
  {
    "id": "Task1",
    "name": "创建项目结构",
    "description": "创建基础的目录结构",
    "status": "pending",
    "dependencies": [],
    "childIds": [],
    "parentId": null,
    "agentRef": null,
    "points": 3,
    "docRef": "tasks/Task1.md",
    "createdAt": "2026-03-05T10:00:00Z",
    "updatedAt": "2026-03-05T10:00:00Z"
  },
  {
    "id": "Task2",
    "name": "...",
    "docRef": "tasks/Task2.md",
    ...
  }
]
```

### 4.3 Agent

文件位置：`.zerocode/agents/Agent1.md`

```markdown
---
id: Agent1
name: 林若曦
role: 产品经理
personality: 经验丰富，擅长分析需求，注重用户体验
expertise:
  - 需求分析
  - 头脑风暴
  - 文档编写
assignedTasks: []
createdAt: 2026-03-05T10:00:00Z
updatedAt: 2026-03-05T10:00:00Z
---

# 林若曦 - 产品经理

## 个人简介
林若曦是一名资深产品经理，拥有 8 年以上的互联网产品经验。她擅长从用户角度出发，分析和梳理需求，能够将模糊的业务想法转化为清晰的产品需求文档。

## 专业能力
- 需求分析：能够深入理解业务场景，提炼核心功能需求
- 头脑风暴：善于引导团队讨论，激发创新思路
- 文档编写：熟练编写 PRD、功能规格说明等文档

## 工作风格
- 注重用户体验，优先考虑用户价值
- 逻辑清晰善于沟通
- 注重数据驱动决策
```

### 4.4 子代理索引文件

文件位置：`.zerocode/agents/index.json`

```json
[
  {
    "id": "Agent1",
    "name": "林若曦",
    "role": "产品经理",
    "assignedTasks": [],
    "docRef": "agents/Agent1.md",
    "createdAt": "2026-03-05T10:00:00Z",
    "updatedAt": "2026-03-05T10:00:00Z"
  },
  {
    "id": "Agent2",
    "name": "张伟",
    "role": "技术经理",
    "assignedTasks": [],
    "docRef": "agents/Agent2.md",
    "createdAt": "2026-03-05T10:00:00Z",
    "updatedAt": "2026-03-05T10:00:00Z"
  },
  {
    "id": "Agent3",
    "name": "李明",
    "role": "程序员",
    "assignedTasks": [],
    "docRef": "agents/Agent3.md",
    "createdAt": "2026-03-05T10:00:00Z",
    "updatedAt": "2026-03-05T10:00:00Z"
  }
]
```

### 4.5 目录结构

```
.zerocode/
├── tasks/
│   ├── index.json
│   ├── Task1.md
│   └── Task2.md
├── agents/
│   ├── index.json
│   ├── Agent1.md
│   ├── Agent2.md
│   └── Agent3.md
└── logs/
    └── Task1/
        └── 2026-03-05-failure-001.md
```

---

## 5. 任务状态

| 状态 | 说明 |
|------|------|
| pending | 未开始 |
| waiting_dep | 等待依赖 |
| processing | 处理中 |
| testing | 测试中 |
| completed | 已完成 |
| failed | 失败（无法自愈） |
| abandoned | 已废弃 |

---

## 6. Skill 命令

### 6.1 Skill（简单操作）

| Skill | 功能 |
|-------|------|
| `zerocode:init` | 初始化项目（创建 .zerocode 目录 + 预制子代理） |
| `zerocode:task-create` | 创建任务（自动拆解） |
| `zerocode:task-list` | 列出任务 |
| `zerocode:task-tree` | 显示任务树 |
| `zerocode:task-show` | 查看任务详情 |
| `zerocode:task-abandon` | 废弃任务 |
| `zerocode:agent-list` | 列出子代理 |

### 6.2 MCP（复杂执行）

| Tool | 功能 |
|------|------|
| `zerocode_execute_task` | 执行任务（含自愈、自动领取） |
| `zerocode_claim_task` | 领取任务（自动选择最小可执行任务） |
| `zerocode_create_session` | 创建新会话用于子代理执行 |

### 6.3 预制子代理

| ID | 名称 | 角色 | 专业领域 | 职责 |
|----|------|------|----------|------|
| Agent1 | 林若曦 | 产品经理 | 需求分析、头脑风暴、文档编写 | 分析需求、编写需求文档、头脑风暴 |
| Agent2 | 张伟 | 技术经理 | 项目管理、技术设计、任务拆解 | 编写技术文档、制定任务计划、任务拆解 |
| Agent3 | 李明 | 程序员 | 各种编程语言和技术 | 执行具体开发任务、解决技术难题 |

**分配策略**:
- 需求分析类任务 → 分配给 Agent1 (林若曦)
- 计划制定类任务 → 分配给 Agent2 (张伟)
- 编码实现类任务 → 分配给 Agent3 (李明)
- 未指定时默认分配给 Agent3 (李明)

---

## 7. 技术栈

| 类别 | 选择 |
|------|------|
| 运行时 | Node.js |
| 语言 | TypeScript |
| 存储 | Markdown + YAML Frontmatter + JSON |
| CLI 框架 | Commander.js |
| MCP | @modelcontextprotocol/server |
| 文件操作 | fs-extra |
| YAML 解析 | yaml |

### 7.1 目录结构

```
zerocode/
├── src/
│   ├── cli/                 # CLI 命令
│   │   ├── commands/       # 命令实现
│   │   └── index.ts        # 入口
│   ├── core/               # 核心逻辑
│   │   ├── TaskManager.ts  # 任务管理
│   │   ├── AgentManager.ts # 子代理管理
│   │   ├── Executor.ts    # 执行器
│   │   └── SelfHealer.ts   # 自愈引擎
│   ├── storage/            # 存储层
│   │   ├── TaskStorage.ts
│   │   ├── AgentStorage.ts
│   │   └── index.ts
│   ├── mcp/                # MCP 服务器
│   │   └── server.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── zerocode.md             # Skill 定义
```

---

## 8. 初始化

### 8.1 初始化时机

- **手动触发**: 用户执行 `/zerocode:init` 命令
- **首次执行时自动触发**: 第一次执行任务时自动初始化

### 8.2 初始化内容

创建 `.zerocode/` 目录结构：
```
.zerocode/
├── tasks/          # 任务文档
│   └── index.json  # 任务索引
├── agents/         # 子代理文档
│   ├── index.json  # 子代理索引
│   ├── Agent1.md  # 产品经理
│   ├── Agent2.md  # 技术经理
│   └── Agent3.md  # 程序员
└── logs/           # 执行日志
```

### 8.3 预制子代理

默认创建三个预制子代理：
- Agent1 (林若曦) - 产品经理
- Agent2 (张伟) - 技术经理
- Agent3 (李明) - 程序员
