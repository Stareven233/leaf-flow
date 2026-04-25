import { Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { Terminal } from '@xterm/xterm'
import type { ITerminalOptions } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { sendExecutionInput, sendExecutionResize } from '@/apis/execution'
import NButton from '@/components/common/NButton'
import { useExecutionLogStore } from '@/stores/executionLog'
import type { TaskLogChunk } from '@/types/execution'

const CONPTY_MODERN_BUILD_FLOOR = 21376
const RESIZE_DEBOUNCE_MS = 150
const TERMINAL_LAYOUT_READY_TIMEOUT_MS = 1200

const TERMINAL_CONFIG: ITerminalOptions = {
  allowTransparency: true,
  convertEol: false,
  cursorBlink: true,
  cursorStyle: 'block',
  fontFamily:
    '"Maple Mono NF CN", "YaHei Monaco Hybird", "Liberation Mono", "Cascadia Mono", "Fira Code", Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.45,
  scrollback: 6000,
  tabStopWidth: 4,
  theme: {
    background: '#0f172a',
    foreground: '#d1d5db',
    cursor: '#86efac',
    cursorAccent: '#0f172a',
    selectionBackground: 'rgba(148, 163, 184, 0.35)',
    black: '#111827',
    red: '#f87171',
    green: '#86efac',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#f472b6',
    cyan: '#67e8f9',
    white: '#e5e7eb',
    brightBlack: '#475569',
    brightRed: '#fca5a5',
    brightGreen: '#bbf7d0',
    brightYellow: '#fde68a',
    brightBlue: '#93c5fd',
    brightMagenta: '#f9a8d4',
    brightCyan: '#a5f3fc',
    brightWhite: '#f8fafc',
  },
  windowsPty: {
    backend: 'conpty',
    buildNumber: CONPTY_MODERN_BUILD_FLOOR,
  },
}

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    window.requestAnimationFrame(() => resolve())
  })

const waitForTerminalLayoutReady = async () => {
  if (typeof window === 'undefined') {
    return
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.race([
        document.fonts.ready.then(() => undefined),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, TERMINAL_LAYOUT_READY_TIMEOUT_MS)
        }),
      ])
    } catch {}
  }

  await waitForNextPaint()
  await waitForNextPaint()
}

const GlobalLogs: Component<{ class?: string }> = (props) => {
  const store = useExecutionLogStore()
  const [terminalSize, setTerminalSize] = createSignal({ cols: 0, rows: 0 })

  let terminalHostRef: HTMLDivElement | undefined
  let terminal: Terminal | undefined
  let fitAddon: FitAddon | undefined
  let resizeObserver: ResizeObserver | undefined
  let renderedLogCount = 0
  let resizeTimer: number | undefined
  let lastSyncedCols = 0
  let lastSyncedRows = 0
  let terminalReady = false

  const writeLogsToTerminal = (logs: TaskLogChunk[]) => {
    if (!terminal || !terminalReady || logs.length === 0) {
      return
    }

    for (const log of logs) {
      terminal.write(log.bytes)
    }
  }

  const flushPendingLogs = () => {
    if (!terminal || !terminalReady) {
      return
    }

    const nextLogs = store.logs()

    if (renderedLogCount > nextLogs.length) {
      terminal.reset()
      renderedLogCount = 0
    }

    if (renderedLogCount === nextLogs.length) {
      return
    }

    const pendingLogs = nextLogs.slice(renderedLogCount)
    renderedLogCount = nextLogs.length
    writeLogsToTerminal(pendingLogs)
  }

  const focusTerminal = () => {
    terminal?.focus()
  }

  const jumpToBottom = () => {
    terminal?.scrollToBottom()
    terminal?.focus()
  }

  const resizeTerminal = () => {
    if (!terminal || !fitAddon) {
      return
    }

    fitAddon.fit()
    const cols = terminal.cols
    const rows = terminal.rows
    setTerminalSize({ cols, rows })

    if (cols <= 0 || rows <= 0 || (cols === lastSyncedCols && rows === lastSyncedRows)) {
      return
    }

    lastSyncedCols = cols
    lastSyncedRows = rows
    sendExecutionResize(cols, rows)
  }

  onMount(() => {
    if (!terminalHostRef) {
      return
    }

    terminal = new Terminal(TERMINAL_CONFIG)
    fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalHostRef)
    terminal.options.disableStdin = !store.isConnected()

    terminal.onData(sendExecutionInput)
    terminal.onResize(setTerminalSize)

    resizeObserver = new ResizeObserver(() => {
      if (typeof window === 'undefined') {
        return
      }

      if (resizeTimer) {
        window.clearTimeout(resizeTimer)
      }
      resizeTimer = window.setTimeout(resizeTerminal, RESIZE_DEBOUNCE_MS)
    })
    resizeObserver.observe(terminalHostRef)

    void (async () => {
      await waitForTerminalLayoutReady()
      if (!terminal) {
        return
      }

      resizeTerminal()
      terminalReady = true
      flushPendingLogs()
      terminal.focus()
    })()
  })

  createEffect(() => {
    store.logs()
    flushPendingLogs()
  })

  createEffect(() => {
    if (!terminal) {
      return
    }
    terminal.options.disableStdin = !store.isConnected()
  })

  onCleanup(() => {
    if (typeof window !== 'undefined' && resizeTimer) {
      window.clearTimeout(resizeTimer)
    }
    resizeObserver?.disconnect()
    terminal?.dispose()
  })

  return (
    <div class={props.class}>
      <div class="flex items-center justify-between px-3 py-2 border-gray-100 bg-gray-50">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-bold text-gray-700">执行日志</h3>
          {!store.isConnected() ? (
            <div class="flex items-center text-red-500 text-xs font-bold px-2 py-0.5 rounded-md bg-red-50">
              <span class="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
              断开
            </div>
          ) : (
            <div class="flex items-center text-green-600 text-xs px-2 py-0.5 rounded-md bg-green-50">
              <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
              活跃
            </div>
          )}
          <span class="text-xs text-gray-400">
            {terminalSize().cols}x{terminalSize().rows}
          </span>
        </div>

        <span class="flex items-center gap-3">
          <NButton
            variant="custom"
            class="text-xs text-gray-700 px-2 py-0.5 rounded border-none hover:text-green-700 ring-1 ring-gray-300 hover:ring-green-400"
            onClick={store.clear}
          >
            清理
          </NButton>
          <NButton
            variant="custom"
            class="text-xs text-gray-700 px-2 py-0.5 rounded border-none hover:text-green-700 ring-1 ring-gray-300 hover:ring-green-400"
            onClick={jumpToBottom}
          >
            ↓底部
          </NButton>
          <span class="text-xs text-gray-400">{store.logs().length} 段输出</span>
        </span>
      </div>

      <div class="relative overflow-hidden rounded-b-md bg-slate-950">
        {}
        <div class="px-2 py-2">
          <div
            ref={terminalHostRef}
            class="global-logs-terminal h-[40vh] min-h-45 cursor-text overflow-hidden"
            onClick={focusTerminal}
          />
        </div>

        {store.logs().length === 0 && (
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            暂无日志，任务运行后会以终端模式实时显示在这里
          </div>
        )}
      </div>
    </div>
  )
}

export default GlobalLogs
