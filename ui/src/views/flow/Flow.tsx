import { createSignal, on, createEffect, onMount, onCleanup, Show, For } from 'solid-js'
import { useAppNavigate } from '@/utils/routes'
import { useFlowStore } from '@/stores/flow'
import { useProjectStore } from '@/stores/project'
import FlowHeader from '@/components/view/FlowHeader'
import BranchTabs from '@/components/view/BranchTabs'
import { ArgumentRow } from '@/components/argumentInput'
import { resolveFlowBranch } from '@/utils/config'
import * as exec from '@/utils/execution'
import type { Argument, ArgumentMap, ArgumentSetter } from '@/types/project'
import NButton from '@/components/common/NButton'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { useStickyBottom } from '@/utils/hooks/useStickyBottom'
import { SimpleArrowDownIcon } from '@/components/common/Icons'
import { NMarkdown } from '@/components/common/NMarkdown'
import { useCommandExecution } from '@/utils/hooks/useCommandExecution'
import { useScroll } from '@/utils/hooks/useScroll'
import ExecuteActionBar from '@/components/ExecuteActionBar'
import dBind from '@/utils/dynamicBind'

export default function FlowView() {
  const params = useDecodedParams()
  const navigate = useAppNavigate()
  const flowStore = useFlowStore()
  const projectStore = useProjectStore()
  const scroll = useScroll({ direction: 'vertical' })

  const [expandedMods, setExpandedMods] = createSignal<Set<number>>(new Set())

  const {
    actionSectionRef,
    sentinelRef,
    isSticky,
    sectionHeight,
    initObservers,
    cleanupObservers,
  } = useStickyBottom()

  const { isExecuting, executionInfo, previewCommands, setPreviewCommands, preview, execute } =
    useCommandExecution()

  const getFlowKey = () => params.flow!

  const getFlow = () => {
    const key = getFlowKey()
    return key ? flowStore.get(key) : undefined
  }

  const getCurrentBranchIndex = () => {
    const flow = getFlow()
    if (!flow) {
      return -1
    }
    return flow.branches.findIndex((b) => b.key === params.branch)
  }

  const getCurrentBranch = () => {
    const flow = getFlow()
    const i = getCurrentBranchIndex()
    return i !== -1 ? flow!.branches[i] : undefined
  }

  const loadTempArgs = () => {
    const flow = getFlow()
    const branch = getCurrentBranch()
    if (!flow || !branch) {
      return
    }

    const tempMap = exec.loadTemporaryArgument('flow', flow.key, branch.key) as Record<
      string,
      ArgumentMap
    >
    if (!tempMap) {
      return
    }

    const bIndex = getCurrentBranchIndex()
    branch.modules.forEach((mod, mIndex) => {
      const argMap = tempMap[mod.key]
      if (!argMap) {
        return
      }

      mod.arguments?.forEach((arg, aIndex) => {
        const value = argMap[arg.key]
        flowStore.set(
          getFlowKey(),
          'branches',
          bIndex,
          'modules',
          mIndex,
          'arguments',
          aIndex,
          'value',
          value,
        )
      })
    })
  }

  const saveTempArgs = () => {
    const flow = getFlow()
    const branch = getCurrentBranch()
    if (!flow || !branch) {
      return
    }

    const tempMap: Record<string, ArgumentMap> = {}
    branch.modules.forEach((mod) => {
      const rmap = exec.gatherArgumentStatus(mod.arguments, undefined, false)
      tempMap[mod.key] = exec.fromRenderMap(rmap, 'rawValue')
    })
    exec.saveTemporaryArgument('flow', flow.key, branch.key, tempMap)
  }

  const clearTempArgs = () => {
    const flow = getFlow()
    const branch = getCurrentBranch()
    if (flow && branch) {
      exec.clearTemporaryArgument('flow', flow.key, branch.key)
    }
  }

  const resolveBranch = async (forceReload: boolean = false) => {
    const flow = forceReload ? await flowStore.fetch(getFlowKey(), true) : getFlow()
    if (!flow || !params.branch) {
      return
    }

    const bIndex = flow.branches.findIndex((b) => b.key === params.branch)
    if (bIndex === -1) {
      return
    }
    const bobj = flow.branches[bIndex]

    const resolved = await resolveFlowBranch(bobj, projectStore.fetch)
    resolved.modules.forEach((mobj, mIndex) => {
      const _set: ArgumentSetter = flowStore.set.bind(
        null,
        flow.key,
        'branches',
        bIndex,
        'modules',
        mIndex,
        'arguments',
      )
      const key = dBind.uniqueKey('F', flow.key, bobj.key, mobj.key)
      dBind.init(key, _set, mobj)
    })
    flowStore.set(flow.key, 'branches', bIndex, resolved)
    loadTempArgs()
  }

  createEffect(
    on(
      () => params.branch,
      () => {
        setPreviewCommands([])
        resolveBranch()
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    cleanupObservers()
  })

  const toggleMod = (index: number) => {
    setExpandedMods((prev) => {
      const s = new Set(prev)
      s.has(index) ? s.delete(index) : s.add(index)
      return s
    })
  }

  const toggleAllMods = () => {
    const branch = getCurrentBranch()
    if (!branch) {
      return
    }
    const allExpanded = expandedMods().size === branch.modules.length
    setExpandedMods(
      allExpanded ? new Set<number>() : new Set<number>(branch.modules.map((_, i) => i)),
    )
  }

  onMount(async () => {
    const flow = getFlow()
    if (!flow) {
      return
    }

    if (!params.branch) {
      const first = flow.branches[0]
      if (first) {
        navigate('flow', flow.key, first.key, { replace: true })
      }
      return
    }

    resolveBranch()
    initObservers()
  })

  const withBranchIndex = (fn: (bIndex: number) => void) => {
    const bIndex = getCurrentBranchIndex()
    if (bIndex !== -1) {
      fn(bIndex)
    }
  }

  const handleModSetArgument = (mIndex: number, aIndex: number, updates: Partial<Argument>) => {
    withBranchIndex((bIndex) => {
      saveTempArgs()
      const bobj = getCurrentBranch()
      const mobj = bobj?.modules[mIndex]
      const aobj = mobj?.arguments?.[aIndex]
      if (!aobj) {
        return
      }

      const fkey = getFlowKey()
      const _set: ArgumentSetter = flowStore.set.bind(
        null,
        fkey,
        'branches',
        bIndex,
        'modules',
        mIndex,
        'arguments',
      )
      for (const [key, val] of Object.entries(updates)) {
        _set(aIndex, key as keyof Argument, val)
      }
      const key = dBind.uniqueKey('F', fkey, bobj!.key, mobj.key)
      dBind.update(key, _set, mobj, aobj, Object.keys(updates))
    })
  }

  const toggleBranchModuleDisabled = (mIndex: number) => {
    withBranchIndex((bIndex) => {
      const mod = getCurrentBranch()?.modules[mIndex]
      if (mod) {
        flowStore.set(
          getFlowKey(),
          'branches',
          bIndex,
          'modules',
          mIndex,
          'disabled',
          !mod.disabled,
        )
      }
    })
  }

  const buildCommands = () => {
    const flow = getFlow()
    const branch = getCurrentBranch()
    if (!flow || !branch) {
      return []
    }

    const commands: string[] = []
    const meta = { ...flow.meta, ...branch.meta }

    branch.modules.forEach((mod) => {
      if (mod.disabled) return
      const rmap = exec.gatherArgumentStatus(mod.arguments, meta, true)
      const templates = Array.isArray(mod.template) ? mod.template : [mod.template]
      commands.push(...templates.map((t) => exec.renderCommand(t, rmap)))
    })
    return commands
  }

  const previewBranch = () => {
    preview(buildCommands())
  }

  const executeBranch = async () => {
    const flow = getFlow()
    const branch = getCurrentBranch()
    if (!flow || !branch) {
      return
    }

    const commands: string[] = []
    const meta = { ...flow.meta, ...branch.meta }
    const rawMap: Record<string, ArgumentMap> = {}
    const allArguments = branch.modules.flatMap((m) => m.arguments ?? [])
    const valid = exec.validateRequiredArguments(allArguments, true)
    if (!valid) {
      return
    }

    branch.modules.forEach((mod) => {
      if (mod.disabled) {
        return
      }
      const rmap = exec.gatherArgumentStatus(mod.arguments, meta, true)
      rawMap[mod.key] = exec.fromRenderMap(rmap, 'rawValue')
      const templates = Array.isArray(mod.template) ? mod.template : [mod.template]
      commands.push(...templates.map((t) => exec.renderCommand(t, rmap)))
    })

    let shell = 'auto'
    let allNoShell = true
    for (const mod of branch.modules) {
      if (mod.disabled) continue
      if (!mod.shell) {
        allNoShell = false
        continue
      }
      shell = mod.shell
      if (mod.shell !== 'no') {
        allNoShell = false
        break
      }
    }
    shell = allNoShell ? 'no' : shell
    exec.saveTemporaryArgument('flow', flow.key, branch.key, rawMap)

    await execute(commands, shell, () => {
      exec.saveExecutedArgument('flow', flow.key, branch.key, rawMap)
    })
  }

  return (
    <div class="w-full mx-auto">
      <Show when={getFlow()}>
        {(flow) => <FlowHeader flow={flow()} onReload={() => resolveBranch(true)} />}
      </Show>

      <section class="p-2 bg-white rounded-lg shadow-sm">
        <Show when={getFlow()}>{(flow) => <BranchTabs branches={flow().branches} />}</Show>

        {}
        <div class="mt-2 mb-6 p-4 bg-green-50 rounded-md">
          {}
          <NMarkdown content={getCurrentBranch()?.desc || getFlow()?.desc || '暂无描述'} />
        </div>

        <div class="flex mb-2 items-center justify-between">
          <h3 class="text-md font-semibold text-gray-800">执行步骤</h3>
          <NButton onClick={toggleAllMods} variant="secondary">
            {expandedMods().size === getCurrentBranch()?.modules.length ? '收起全部' : '展开全部'}
          </NButton>
        </div>
        {}
        <For each={getCurrentBranch()?.modules}>
          {(mod, mIndex) => (
            <div class="border border-gray-200 rounded-lg overflow-visible mb-2">
              {}
              <div
                class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                classList={{
                  'bg-gray-50': !mod.disabled,
                  'bg-gray-100': !!mod.disabled,
                }}
                onClick={() => toggleMod(mIndex())}
              >
                <div class="flex items-center gap-3">
                  {}
                  <span
                    class="flex shrink-0 items-center justify-center w-8 h-8 text-white rounded-full text-sm font-semibold cursor-pointer transition-colors"
                    classList={{
                      'bg-green-400 hover:bg-green-500': !mod.disabled,
                      'bg-gray-400 hover:bg-gray-500': !!mod.disabled,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleBranchModuleDisabled(mIndex())
                    }}
                  >
                    {mIndex() + 1}
                  </span>
                  {}
                  <header class="max-h-32">
                    <div class="mb-2 flex flex-row gap-2 items-baseline">
                      <h3 class="font-semibold text-gray-700">
                        {mod.name || `步骤 ${mIndex() + 1}`}
                      </h3>
                      <Show when={mod.key}>
                        <span class="text-xs text-gray-500">{mod.key}</span>
                      </Show>
                    </div>
                    <div ref={scroll.ref} class="max-h-28">
                      <NMarkdown ref={scroll.ref} content={mod.desc ?? ''} />
                    </div>
                    {}
                  </header>
                </div>
                <SimpleArrowDownIcon
                  class="h-5 w-5 text-gray-500 transition-transform"
                  classList={{ 'rotate-180': expandedMods().has(mIndex()) }}
                />
              </div>

              <Show when={expandedMods().has(mIndex())}>
                <div class="px-4 pb-4 space-y-2 bg-white">
                  <Show when={!mod.arguments || mod.arguments.length === 0}>
                    <p class="text-sm text-gray-500">此步骤无参数</p>
                  </Show>
                  <For each={mod.arguments}>
                    {(argument, aIndex) => (
                      <ArgumentRow
                        argument={argument}
                        setArgument={(updates) => handleModSetArgument(mIndex(), aIndex(), updates)}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </section>

      <ExecuteActionBar
        sentinelRef={sentinelRef}
        isSticky={isSticky()}
        sectionHeight={sectionHeight()}
        actionSectionRef={actionSectionRef}
        isExecuting={isExecuting()}
        executionInfo={executionInfo()}
        previewCommands={previewCommands()}
        onSave={saveTempArgs}
        onClear={clearTempArgs}
        onPreview={previewBranch}
        onExecute={executeBranch}
        onClosePreview={() => setPreviewCommands([])}
      />
    </div>
  )
}
