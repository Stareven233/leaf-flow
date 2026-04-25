export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ExecutionTask {
  id: number
  commands: string[]
  shell: string
  status: TaskStatus
  createdAt: string
  startedAt?: string
  endedAt?: string
  error?: string
}

export interface ExecutionQueueState {
  tasks: ExecutionTask[]
  total: number
  completed: number
  pending: number
}

export interface ExecutionLog {
  content: string
  timestamp: string
}

export interface TaskLogChunk {
  bytes: Uint8Array
}

export interface TaskStatusEvent {
  event: 'task_status'
  task: ExecutionTask
  total: number
}
