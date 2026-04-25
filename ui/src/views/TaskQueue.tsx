import { Component, createSignal, onMount, onCleanup, For } from 'solid-js'
import { getTasks, cancelTask } from '@/apis/execution'
import type {
  TaskStatus,
  ExecutionTask,
  ExecutionQueueState,
  TaskStatusEvent,
} from '@/types/execution'
import NButton from '@/components/common/NButton'
import GlobalLogs from '@/components/GlobalLogs'
import { useScroll } from '@/utils/hooks/useScroll'
import { DeleteIcon } from '@/components/common/Icons'
import { useExecutionLogStore } from '@/stores/executionLog'

const LIMIT = 20

function throttle<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let lastTime = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn(...args)
    }
  }
}

const statusColor: Record<TaskStatus, string> = {
  completed: 'text-green-600',
  failed: 'text-red-500',
  running: 'text-green-500',
  cancelled: 'text-orange-300',
  pending: 'text-gray-500',
}

const taskHoverColor: Record<TaskStatus, string> = {
  completed: 'hover:bg-green-50',
  failed: 'hover:bg-red-50',
  running: 'hover:bg-green-50',
  cancelled: 'hover:bg-orange-50',
  pending: 'hover:bg-gray-50',
}

const formatDate = (dateStr?: string) => {
  if (!dateStr || dateStr.startsWith('0001-01-01')) {
    return '-'
  }
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours()
  const minute = d.getMinutes()
  const second = d.getSeconds()
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
}

const ScrollableText: Component<{ text: string }> = (props) => {
  const scroll = useScroll()
  return (
    <span ref={scroll.ref} class="flex-1 truncate font-mono text-sm text-gray-700 px-4">
      {props.text}
    </span>
  )
}

const TaskQueueView: Component = () => {
  const logStore = useExecutionLogStore()
  const [tasks, setTasks] = createSignal<ExecutionTask[]>([])
  const [total, setTotal] = createSignal(0)
  const [loading, setLoading] = createSignal(false)
  const [hasMore, setHasMore] = createSignal(true)
  const [expanded, setExpanded] = createSignal<Set<number>>(new Set())

  let isLoadingMore = false

  const loadMoreTasks = async () => {
    if (isLoadingMore || !hasMore()) {
      return
    }
    isLoadingMore = true
    setLoading(true)

    const taskList = tasks()
    const lastTaskId = taskList.length > 0 ? taskList[taskList.length - 1]!.id : undefined
    const res = await getTasks(lastTaskId, -LIMIT)

    if (res.success && res.data) {
      const data: ExecutionQueueState = res.data
      if (data.tasks.length < LIMIT) {
        setHasMore(false)
      }
      setTotal(data.total)
      setTasks((prev) => [...prev, ...data.tasks.slice().reverse()])
    } else {
      setHasMore(false)
    }
    setLoading(false)
    isLoadingMore = false
  }

  const handleScroll = throttle((e: Event) => {
    const target = e.target as HTMLElement
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 200) {
      loadMoreTasks()
    }
  }, 100)

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const onCancel = async (task: ExecutionTask, e: Event) => {
    e.stopPropagation()
    if (!confirm(`确定取消任务 #${task.id} 吗?`)) {
      return
    }

    const res = await cancelTask(task.id)
    if (res.success) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'cancelled' as TaskStatus } : t)),
      )
    }
  }

  const applyTaskStatusUpdate = (event: TaskStatusEvent) => {
    setTotal(event.total)
    setTasks((prev) => {
      const next = [...prev]
      const index = next.findIndex((item) => item.id === event.task.id)
      if (index >= 0) {
        next[index] = event.task
      } else {
        const insertAt = next.findIndex((item) => item.id < event.task.id)
        if (insertAt === -1) {
          next.push(event.task)
        } else {
          next.splice(insertAt, 0, event.task)
        }
      }
      setHasMore(next.length < event.total)
      return next
    })
  }

  onMount(() => {
    logStore.setTaskStatusCallback(applyTaskStatusUpdate)
    loadMoreTasks()
  })

  onCleanup(() => {
    logStore.setTaskStatusCallback(null)
  })

  return (
    <div class="flex flex-col max-h-screen bg-white overflow-hidden">
      {}
      <div class="shrink-0 flex-none p-4 border-b border-gray-200 flex justify-between items-center">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold text-gray-800">任务队列</h1>
        </div>
        <div class="text-sm text-gray-500">
          已加载: {tasks().length} / {total()}
        </div>
      </div>

      {}
      <GlobalLogs class="shrink-0 flex-none mx-4 my-4 rounded border-b border-gray-700" />

      {}
      <div class="flex-1 p-4 space-y-3 overflow-y-auto no-scrollbar" onScroll={handleScroll}>
        <For each={tasks()}>
          {(t) => (
            <div class="shadow rounded-lg overflow-hidden transition-all hover:shadow-md shrink-0">
              {}
              <div
                class={`flex items-center px-3 py-2 bg-gray-50 cursor-pointer select-none ${taskHoverColor[t.status]}`}
                onClick={() => toggleExpand(t.id)}
              >
                <span class="w-16 font-mono text-gray-500">#{t.id}</span>

                <span
                  class={`w-24 ${statusColor[t.status]} ${t.status === 'running' ? 'font-bold' : 'font-medium'}`}
                >
                  {t.status}
                </span>

                <ScrollableText text={t.commands.join(' && ')} />

                <NButton
                  variant="error"
                  class="p-2! text-xs!"
                  onClick={(e) => onCancel(t, e)}
                  disabled={t.status !== 'running' && t.status !== 'pending'}
                >
                  <DeleteIcon />
                </NButton>

                <span class="text-sm text-gray-400 mx-4">{formatDate(t.createdAt)}</span>

                <div class="w-8 flex justify-center">
                  <span>{expanded().has(t.id) ? '▼' : '▶'}</span>
                </div>
              </div>

              {}
              {expanded().has(t.id) && (
                <div class="p-4 border-gray-200 bg-white text-sm">
                  <div class="grid grid-cols-2 gap-2 mb-2">
                    <span>
                      <span class="text-gray-500">Shell:</span> {t.shell || 'auto'}
                    </span>
                    <span>
                      <span class="text-gray-500">Created:</span> {formatDate(t.createdAt)}
                    </span>
                    <span>
                      <span class="text-gray-500">Started:</span> {formatDate(t.startedAt)}
                    </span>
                    <span>
                      <span class="text-gray-500">Ended:</span> {formatDate(t.endedAt)}
                    </span>
                  </div>

                  <div class="mb-2">
                    <div class="text-gray-500 mb-1">Commands:</div>
                    <pre class="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">
                      {t.commands.join('\n')}
                    </pre>
                  </div>

                  {t.error && (
                    <div class="mt-2">
                      <div class="text-red-500 font-bold mb-1">Error:</div>
                      <pre class="bg-red-50 text-red-600 p-2 rounded text-xs overflow-x-auto">
                        {t.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </For>

        {loading() && <div class="text-center py-4 text-gray-400">加载中...</div>}

        {!hasMore() && tasks().length > 0 && (
          <div class="text-center pt-4 text-gray-300 text-xs">- 没有更多任务了 -</div>
        )}

        {!loading() && tasks().length === 0 && (
          <div class="text-center py-8 text-gray-400">暂无任务</div>
        )}
      </div>
    </div>
  )
}

export default TaskQueueView
