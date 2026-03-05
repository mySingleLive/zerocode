# ZeroCode - Claude Code 任务管理与执行插件

## 项目概述

一个用于对项目进行任务拆解/管理/执行的插件，该插件可以让 Claude Code 等 Agent 可以持续性地、不间断地执行完项目所有已有任务，当执行任务过程中出现问题，则会自行分析问题，找到问题的解决方案，并执行解决问题的方案直到问题解决为止，然后执行下一个任务，循环往复，直到所有问题和所有任务都解决完成为止。并且在任务的执行过程中可通过命令或web界面实时查看各个任务的执行状态，方便管理。

---

## 核心功能

1. **Claude Code 插件项目** - 通过 Claude Code 中的 `/plugin` 命令安装，提供多个插件命令
2. **项目图谱** - 将项目的描述、功能、架构、文件结构、完成的需求以多个文件的形式保持下来
3. **需求管理** - 头脑风暴后拆解需求，管理需求版本
4. **任务管理** - 任务的创建、查看、列表、废弃、树形展示
5. **任务执行** - 自动执行任务，包含 TDD、自愈循环、验收测试
6. **子代理管理** - 创建/修改/删除子代理，扁平组织架构
7. **Web 界面** - 按需启动，实时查看任务状态

---

## 技术栈

- **运行时**: Node.js
- **语言**: TypeScript
- **存储**: JSON + Markdown（结构化内容用 JSON，描述性内容用 Markdown）
- **交互**: Claude Code Skills
- **Web**: 按需启动的嵌入式 HTTP 服务器

---

## 整体架构

```
zerocode/
├── src/
│   ├── core/           # 核心引擎
│   │   ├── executor.ts       # 任务执行器（含自愈逻辑）
│   │   ├── planner.ts        # 任务规划/依赖分析
│   │   └── storage.ts        # JSON/Markdown 存储管理
│   ├── modules/
│   │   ├── task/        # 任务管理模块
│   │   ├── requirement/ # 需求管理模块
│   │   └── agent/       # 子代理管理模块
│   ├── skills/          # Claude Code Skills
│   │   ├── task-*.ts
│   │   ├── requirement-*.ts
│   │   └── agent-*.ts
│   ├── web/             # Web 服务
│   │   └── server.ts
│   └── cli.ts          # 命令行入口
├── data/               # 数据存储目录
│   ├── tasks/
│   ├── requirements/
│   ├── agents/
│   └── index.json      # 主索引文件
└── package.json
```

---

## 执行架构

```
AI Agent → Skill → zerocode CLI 命令 → 脚本 → 内部Skill (Optional)
```

**说明：**
- **AI Agent**：Claude Code 等 Agent
- **Skill**：Claude Code Skills（如 `zerocode:task-create`）
- **zerocode CLI 命令**：底层 CLI 命令（如 `zerocode task create`）
- **脚本**：具体执行的脚本逻辑
- **内部Skill (Optional)**：可选的内部 Skill，用于更细粒度的操作

---

## 数据模型

### Task (JSON)

```json
{
  "id": "T001",
  "name": "创建项目结构",
  "description": "创建基础的目录结构",
  "status": "pending",
  "dependencies": [],
  "acceptanceCriteria": [
    { "given": "项目根目录", "when": "执行初始化命令", "then": "生成 src/、data/ 等目录" }
  ],
  "completionConditions": [],
  "parentId": null,
  "childIds": [],
  "requirementRef": "requirements/R001.md",
  "points": 3,
  "testCaseRef": "tests/T001.test.ts"
}
```

### Requirement

- `requirements/R001.md` - 需求的详细描述（Markdown）
- `requirements/index.json` - 引用列表，包含版本历史

### Agent

```json
{
  "id": "A001",
  "name": "张工",
  "role": "高级前端工程师",
  "personality": "严谨细心，注重代码质量",
  "expertise": ["React", "TypeScript", "CSS"],
  "assignedTasks": ["T001", "T002"]
}
```

---

## 执行流程

```
执行任务 T001
    │
    ├─► 检查依赖
    │     └─► 递归执行依赖任务
    │
    ├─► TDD: 生成验收测试用例
    │
    ├─► 执行任务（调用 Skill）
    │
    ├─► 状态 → testing
    │     └─► 运行测试用例
    │           ├─► 失败 → 分析原因 → 修复 → 重测 (循环)
    │           └─► 通过 → 检查完成条件
    │
    ├─► 检查完成条件
    │     ├─► 不满足 → 分析 → 修复 → 重检 (循环)
    │     └─► 满足 → 状态 → completed
    │
    └─► 继续下一个任务
```

---

## Skill 设计

| Skill | 功能 |
|-------|------|
| `zerocode:task-create` | 创建任务 |
| `zerocode:task-execute` | 执行任务（含自愈） |
| `zerocode:task-list` | 列出任务 |
| `zerocode:task-tree` | 显示任务树 |
| `zerocode:task-show` | 查看任务详情 |
| `zerocode:task-abandon` | 废弃任务 |
| `zerocode:requirement-brainstorm` | 需求头脑风暴 |
| `zerocode:requirement-create` | 创建需求 |
| `zerocode:requirement-split` | 拆解需求为任务 |
| `zerocode:agent-create` | 创建子代理 |
| `zerocode:agent-list` | 列出子代理 |
| `zerocode:web-start` | 启动 Web 界面 |

---

## 任务状态

| 状态 | 说明 |
|------|------|
| pending | 未开始 |
| waiting_dep | 等待依赖 |
| processing | 处理中 |
| testing | 测试中 |
| completed | 已完成 |
| abandoned | 已废弃 |

---

## 点数评估

完成该任务所需消耗的 Token 点数，1/10 个 Agent 上下文窗口为 1 点，2/10 个为 2 点，以此类推。创建或拆解任务时必须评估点数。
