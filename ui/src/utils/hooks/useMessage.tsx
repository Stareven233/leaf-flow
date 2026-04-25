import { createSignal, For } from 'solid-js'
import NButton from '@/components/common/NButton'

export type MessageType = 'success' | 'error' | 'warning' | 'info'

interface Message {
  id: number
  type: MessageType
  content: string
  duration: number
}

const [messages, setMessages] = createSignal<Message[]>([])
let messageId = 0
const defaultDuration = 3000

export function useMessage() {
  const show = (content: string, type: MessageType = 'info', duration = defaultDuration) => {
    const id = messageId++
    setMessages((prev) => [...prev, { id, type, content, duration }])

    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  const remove = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return {
    success: (content: string, duration = defaultDuration) => show(content, 'success', duration),
    error: (content: string, duration = defaultDuration) => show(content, 'error', duration),
    warning: (content: string, duration = defaultDuration) => show(content, 'warning', duration),
    info: (content: string, duration = defaultDuration) => show(content, 'info', duration),
  }
}

export function MessageContainer() {
  const typeStyles = {
    success: 'bg-green-400',
    error: 'bg-red-400',
    warning: 'bg-yellow-300',
    info: 'bg-blue-400',
  }

  const remove = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={messages()}>
        {(msg) => (
          <div
            class={`${typeStyles[msg.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto animate-[slideDown_0.3s_ease]`}
          >
            <span>{msg.content}</span>
            <NButton
              variant="error"
              onClick={() => remove(msg.id)}
              class="hover:bg-white/20 rounded px-2 py-0.5 transition-colors"
            >
              ✕
            </NButton>
          </div>
        )}
      </For>
    </div>
  )
}
