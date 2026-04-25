import { createSignal } from 'solid-js'
import { executeCommand } from '@/apis/execution'

export function useCommandExecution() {
  const [isExecuting, setIsExecuting] = createSignal(false)
  const [executionInfo, setExecutionInfo] = createSignal('')
  const [previewCommands, setPreviewCommands] = createSignal<string[]>([])

  const preview = (commands: string[]) => {
    setPreviewCommands(commands)
    setExecutionInfo('')
  }

  const execute = async (commands: string[], shell: string, onSuccess?: () => void) => {
    setIsExecuting(true)
    setExecutionInfo('处理中...')
    setPreviewCommands([])

    try {
      const response = await executeCommand(commands, shell)
      if (response.success) {
        onSuccess?.()
        setExecutionInfo('任务已推入队列，请等待执行完成')
      } else {
        setExecutionInfo(response.message || '任务推入失败')
      }
    } catch (error) {
      setExecutionInfo(error instanceof Error ? error.message : '任务推入过程中发生错误')
    } finally {
      setIsExecuting(false)
      setTimeout(() => setExecutionInfo(''), 3000)
    }
  }

  return {
    isExecuting,
    executionInfo,
    previewCommands,
    setPreviewCommands,
    preview,
    execute,
  }
}
