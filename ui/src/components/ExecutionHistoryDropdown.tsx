import { Component, createSignal, onMount, onCleanup, Index, For } from 'solid-js'
import { loadExecutedArguments, clearExecutedArgument } from '@/utils/execution'
import type { SavedArgument, EntryType, ArgumentMap } from '@/types/project'
import NButton from '@/components/common/NButton'
import { useProjectStore } from '@/stores/project'
import { useFlowStore } from '@/stores/flow'
import { DeleteIcon, ClockIcon } from '@/components/common/Icons'

interface ExecutionHistoryDropdownProps {
  type: EntryType
  key: string
  restoreFunc: (item: SavedArgument) => void
}

const delDebounceTime = 2000

const ExecutionHistoryDropdown: Component<ExecutionHistoryDropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [historyItems, setHistoryItems] = createSignal<{ index: number; item: SavedArgument }[]>([])
  const [pendingDeletes, setPendingDeletes] = createSignal<Set<number>>(new Set())
  let deleteTimeout: ReturnType<typeof setTimeout> | null = null
  const unifiedStore = props.type === 'flow' ? useFlowStore() : useProjectStore()

  const refresh = () => {
    const all = loadExecutedArguments(props.type, props.key)
    const pending = pendingDeletes()
    setHistoryItems(all.filter((i) => !pending.has(i.index)))
  }

  const openDropdown = () => {
    setIsOpen(true)
    refresh()
  }

  const closeDropdown = () => {
    setIsOpen(false)
  }

  const restore = (entry: { index: number; item: SavedArgument }) => {
    closeDropdown()
    props.restoreFunc(entry.item)
  }

  const removeItem = (index: number) => {
    const newPending = new Set(pendingDeletes())
    newPending.add(index)
    setPendingDeletes(newPending)

    setHistoryItems(historyItems().filter((i) => i.index !== index))

    if (deleteTimeout) {
      clearTimeout(deleteTimeout)
    }

    deleteTimeout = setTimeout(() => {
      const currentPending = pendingDeletes()
      if (currentPending.size > 0) {
        clearExecutedArgument(Array.from(currentPending))
        setPendingDeletes(new Set<number>())
      }
      deleteTimeout = null
    }, delDebounceTime)
  }

  const clearAll = () => {
    const indices = loadExecutedArguments(props.type, props.key).map((i) => i.index)
    clearExecutedArgument(indices)
    refresh()
  }

  const formatArgs = (map: ArgumentMap) => {
    return Object.entries(map)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`)
      .join(', ')
  }

  const formatFlowMaps = (maps: Record<string, ArgumentMap>) => {
    return Object.entries(maps).map(([mkey, map]) => ({ mkey, summary: formatArgs(map) }))
  }

  const getItemTitle = (item: SavedArgument) => {
    const main = unifiedStore.get(item.key) as any
    const sub = props.type === 'flow' ? 'branches' : 'modules'
    for (const t of main[sub]) {
      if (t.key !== item.subKey) {
        continue
      }
      return t.name
    }
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const container = e.currentTarget as HTMLElement
    if (e.deltaY !== 0) {
      container.scrollLeft += e.deltaY
    }
  }

  const attachWheelListener = (el: HTMLElement) => {
    el.addEventListener('wheel', handleWheel as any, { passive: false })
  }

  onMount(() => {
    refresh()
  })

  onCleanup(() => {
    if (deleteTimeout) {
      clearTimeout(deleteTimeout)
      const currentPending = pendingDeletes()
      if (currentPending.size > 0) {
        clearExecutedArgument(Array.from(currentPending))
      }
    }
  })

  return (
    <div
      class="relative inline-block text-left"
      onMouseEnter={openDropdown}
      onMouseLeave={closeDropdown}
    >
      <NButton variant="secondary">
        <ClockIcon class="mr-2" />
        执行历史 ({historyItems().length})
      </NButton>

      {}
      <div
        class="nscroll-bar absolute right-0 pt-1 w-80 bg-white rounded-md shadow-lg z-30 ring-1 ring-gray-200 max-h-96 overflow-y-auto custom-scrollbar"
        style={{ display: isOpen() ? 'block' : 'none' }}
      >
        <div class="px-4 py-2 flex justify-between items-center border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
          <span class="text-xs text-gray-500">共 {historyItems().length} 条记录</span>
          <NButton
            variant="custom"
            onClick={clearAll}
            class="text-xs text-red-400 hover:text-red-600 cursor-pointer transition-colors"
          >
            清空所有
          </NButton>
        </div>
        {}
        <Index each={historyItems()}>
          {(item, idx) => (
            <div
              class="group px-4 py-2 hover:bg-gray-50 flex flex-col gap-1 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
              onClick={() => restore(item())}
            >
              <div class="flex justify-between items-center">
                <span class="font-medium text-sm text-green-700 flex items-center gap-2">
                  <span class="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
                    #{historyItems().length - idx}
                  </span>
                  {getItemTitle(item().item)}
                </span>
                <NButton
                  type="button"
                  variant="error"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    removeItem(item().index)
                  }}
                >
                  <DeleteIcon />
                </NButton>
              </div>
              {}
              {(() => {
                const entry = item().item
                if (entry.type === 'flow') {
                  return (
                    <For each={formatFlowMaps(entry.map as Record<string, ArgumentMap>)}>
                      {({ mkey, summary }) => (
                        <div class="flex flex-col gap-0.5">
                          <span class="text-xs text-gray-400">{mkey}</span>
                          <span
                            ref={attachWheelListener}
                            class="text-xs text-gray-500 font-mono bg-gray-50 hover:bg-green-50 p-1 rounded flex whitespace-nowrap overflow-x-scroll no-scrollbar"
                          >
                            {summary || '(无参数)'}
                          </span>
                        </div>
                      )}
                    </For>
                  )
                }
                return (
                  <span
                    ref={attachWheelListener}
                    class="text-xs text-gray-500 font-mono bg-gray-50 hover:bg-green-50 p-1 rounded flex whitespace-nowrap overflow-x-scroll no-scrollbar"
                  >
                    {formatArgs(entry.map as ArgumentMap)}
                  </span>
                )
              })()}
            </div>
          )}
        </Index>
      </div>
    </div>
  )
}

export default ExecutionHistoryDropdown
