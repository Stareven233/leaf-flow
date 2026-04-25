import { Component, onMount, onCleanup, createSignal } from 'solid-js'
import { A } from '@solidjs/router'
import type { RouteSectionProps } from '@solidjs/router'
import { useExecutionLogStore } from '@/stores/executionLog'
import { useConfigStore } from '@/stores/config'
import { MessageContainer } from '@/utils/hooks/useMessage'

const anchorCls = 'text-gray-800 hover:text-green-500 rounded-md transition-colors'

const App: Component<RouteSectionProps> = (props) => {
  const logStore = useExecutionLogStore()
  const cfgStore = useConfigStore()

  onMount(async () => {
    cfgStore.fetch()
    logStore.init()
    window.addEventListener('beforeunload', logStore.close)
  })

  onCleanup(() => {
    logStore.close()
    window.removeEventListener('beforeunload', logStore.close)
  })

  const [footerOpen, setFooterOpen] = createSignal(false)

  return (
    <div class="min-h-screen flex flex-col bg-gray-50">
      <MessageContainer />
      {}
      <nav class="bg-white border-b border-gray-200 shadow-sm">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <A href="/" class={'text-xl font-bold px-3 py-2' + anchorCls}>
                Leaf²
              </A>
            </div>
            <div class="flex items-center space-x-4">
              <A href="/tasks" class={'px-3 py-2' + anchorCls}>
                任务详情
              </A>
            </div>
          </div>
        </div>
      </nav>

      {}
      <main class="container mx-auto py-6 px-4 grow flex flex-col">{props.children}</main>

      {}
      <div class="fixed bottom-0 left-0 right-0 h-4 group" onClick={() => setFooterOpen((v) => !v)}>
        <footer
          class={`absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 transition-transform duration-300 ${footerOpen() ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`}
        >
          <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 text-sm">
            <a
              href="https://github.com/Stareven233"
              target="_blank"
              rel="noopener noreferrer"
              class={anchorCls}
            >
              獭栖八雫
            </a>
            © Leaf² | a <b>l</b>ightweight <b>ea</b>sy <b>f</b>ast and <b>f</b>lexible execution
            framework
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
