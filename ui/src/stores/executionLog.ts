import { createSignal } from 'solid-js'
import { executionLogStreamUrl, executionStatusEventUrl } from '@/apis/execution'
import type { TaskStatusEvent, TaskLogChunk } from '@/types/execution'

const maxRetryCnt = 3
let logRetryCnt = 0
let statusRetryCnt = 0

const [logs, setLogs] = createSignal<TaskLogChunk[]>([])
const [isConnected, setIsConnected] = createSignal(false)
let statusEventSource: EventSource | null = null
let logStreamAbortController: AbortController | null = null
let onNewLogCallback: (() => void) | null = null
let onTaskStatusCallback: ((event: TaskStatusEvent) => void) | null = null

async function connectLogStream() {
  if (logStreamAbortController) {
    return
  }

  const controller = new AbortController()
  logStreamAbortController = controller

  try {
    const response = await fetch(executionLogStreamUrl, {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`日志流连接失败: ${response.status}`)
    }
    if (!response.body) {
      throw new Error('浏览器不支持流式日志读取')
    }

    logRetryCnt = 0
    setIsConnected(true)

    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!value || value.length === 0) {
        continue
      }

      setLogs((prev) => [...prev, { bytes: value.slice() }])
      if (onNewLogCallback) {
        onNewLogCallback()
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return
    }
    console.error('Log stream error:', error)
  } finally {
    if (logStreamAbortController === controller) {
      logStreamAbortController = null
    }
    setIsConnected(false)

    if (!controller.signal.aborted && logRetryCnt++ < maxRetryCnt) {
      setTimeout(() => {
        console.log(`日志流正在尝试第${logRetryCnt}/${maxRetryCnt}次重连...`)
        connectLogStream()
      }, 3000)
    }
  }
}

function connectStatusEvent() {
  if (statusEventSource) {
    return
  }

  const es = new EventSource(executionStatusEventUrl)

  es.onopen = () => {
    statusRetryCnt = 0
  }

  es.onmessage = (event) => {
    try {
      const statusEvent = JSON.parse(event.data) as TaskStatusEvent
      if (statusEvent.event === 'task_status' && onTaskStatusCallback) {
        onTaskStatusCallback(statusEvent)
      }
    } catch {}
  }

  es.onerror = (error) => {
    console.error('Status SSE Error:', error)
    es.close()
    statusEventSource = null

    if (statusRetryCnt++ < maxRetryCnt) {
      setTimeout(() => {
        console.log(`状态流正在尝试第${statusRetryCnt}/${maxRetryCnt}次重连...`)
        connectStatusEvent()
      }, 3000)
    }
  }

  statusEventSource = es
}

export function useExecutionLogStore() {
  const init = () => {
    connectStatusEvent()
    connectLogStream()
  }

  const clear = () => {
    setLogs([])
  }

  const close = () => {
    if (statusEventSource) {
      statusEventSource.close()
      statusEventSource = null
    }
    if (logStreamAbortController) {
      logStreamAbortController.abort()
      logStreamAbortController = null
    }
    setIsConnected(false)
  }

  const setScrollCallback = (cb: () => void) => {
    onNewLogCallback = cb
  }

  const setTaskStatusCallback = (cb: ((event: TaskStatusEvent) => void) | null) => {
    onTaskStatusCallback = cb
  }

  return {
    logs,
    clear,
    isConnected,
    init,
    close,
    setScrollCallback,
    setTaskStatusCallback,
  }
}
