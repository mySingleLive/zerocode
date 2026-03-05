// Task status enum
export type TaskStatus = 'pending' | 'waiting_dep' | 'processing' | 'testing' | 'completed' | 'failed' | 'abandoned';

// Task acceptance criteria
export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

// Task model
export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  childIds: string[];
  parentId: string | null;
  agentRef: string | null;
  acceptanceCriteria: AcceptanceCriterion[];
  completionConditions: string[];
  requirementRef: string | null;
  points: number;
  testCaseRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// Task index item (lightweight)
export interface TaskIndexItem {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  childIds: string[];
  parentId: string | null;
  agentRef: string | null;
  points: number;
  docRef: string;
  createdAt: string;
  updatedAt: string;
}

// Agent model
export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  expertise: string[];
  assignedTasks: string[];
  createdAt: string;
  updatedAt: string;
}

// Agent index item
export interface AgentIndexItem {
  id: string;
  name: string;
  role: string;
  assignedTasks: string[];
  docRef: string;
  createdAt: string;
  updatedAt: string;
}

// Failure log entry
export interface FailureLog {
  id: string;
  taskId: string;
  timestamp: string;
  error: string;
  rootCause: string;
  fixAttempt: string;
  success: boolean;
}
