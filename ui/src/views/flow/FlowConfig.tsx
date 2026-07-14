import { Component, Show, For, onMount, createSignal } from 'solid-js'
import { useLocation } from '@solidjs/router'
import { useFlowStore } from '@/stores/flow'
import FlowHeader from '@/components/view/FlowHeader'
import { MetaSection } from '@/components/view/ModuleMeta'
import NMarkdown from '@/components/common/NMarkdown'
import type { ArgumentValue, ArgumentDType, ArgumentMethod, Argument } from '@/types/project'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { useScroll } from '@/utils/hooks/useScroll'
import { resolveFlowBranch } from '@/utils/config'
import { fetchProject } from '@/apis/project'
import dBind from '@/utils/dynamicBind'

const FlowConfig: Component = () => {
  const params = useDecodedParams()
  const location = useLocation()
  const scroll = useScroll()
  const flowStore = useFlowStore()
  const flow = () => flowStore.get(params.flow!)

  const state = location.state as { branch?: string } | null
  const [selectedBranch, setSelectedBranch] = createSignal(
    (() => {
      const f = flow()
      if (!f?.branches.length) {
        return ''
      }
      return state?.branch && f.branches.find((b) => b.key === state.branch)
        ? state.branch
        : f.branches[0].key
    })(),
  )

  const getSelectedBranchIndex = () =>
    flow()?.branches.findIndex((b) => b.key === selectedBranch()) ?? -1
  const getSelectedBranch = () => {
    const f = flow()
    const branchIndex = getSelectedBranchIndex()
    return f && branchIndex !== -1 ? f.branches[branchIndex] : null
  }

  const handleSetFlowMeta = (key: string, updates: Partial<Argument>) => {
    const f = flow()
    if (!f?.meta) {
      return
    }
    const fkey = params.flow!

    for (const [k, v] of Object.entries(updates)) {
      flowStore.set(fkey, 'meta', key, k as keyof Argument, v as any)
    }

    const changedKeys = Object.keys(updates)
    if (changedKeys.length > 0) {
      for (let bIndex = 0; bIndex < f.branches.length; bIndex++) {
        const branch = f.branches[bIndex]
        for (let mIndex = 0; mIndex < branch.modules.length; mIndex++) {
          const mobj = branch.modules[mIndex]
          const cacheKey = dBind.uniqueKey('F', fkey, branch.key, mobj.key)
          const setFunc = flowStore.set.bind(
            null,
            fkey,
            'branches',
            bIndex,
            'modules',
            mIndex,
            'arguments',
          )

          const virtualArg = { key } as any
          dBind.update(cacheKey, setFunc, mobj, virtualArg, changedKeys, f.meta, branch.meta)
        }
      }
    }
  }

  const updateFlowMeta = (key: string, value: Argument) => {
    const f = flow()
    if (!f?.meta) {
      return
    }
    const oldValue = f.meta[key]

    const updates: Partial<Argument> = {}
    if (oldValue) {
      for (const k of Object.keys(value) as (keyof Argument)[]) {
        if (value[k] !== oldValue[k]) {
          updates[k] = value[k] as any
        }
      }
    } else {
      Object.assign(updates, value)
    }

    if (Object.keys(updates).length > 0) {
      handleSetFlowMeta(key, updates)
    }
  }

  const deleteFlowMeta = (key: string) => {
    const meta = flow()?.meta
    if (!meta) {
      return
    }
    const { [key]: _, ...rest } = meta
    flowStore.set(params.flow!, { meta: rest })
  }

  const addFlowMeta = (
    key: string,
    dtype: ArgumentDType,
    method: ArgumentMethod | undefined,
    value: ArgumentValue,
  ) => {
    const meta = flow()?.meta || {}
    const newAobj: Argument = { key, name: key, dtype, value }
    if (method) {
      newAobj.method = method
    }
    flowStore.set(params.flow!, 'meta', { ...meta, [key]: newAobj })
  }

  const handleSetBranchMeta = (key: string, updates: Partial<Argument>) => {
    const branchIndex = getSelectedBranchIndex()
    const branch = getSelectedBranch()
    const f = flow()
    if (branchIndex === -1 || !branch?.meta || !f) {
      return
    }
    const fkey = params.flow!

    for (const [k, v] of Object.entries(updates)) {
      flowStore.set(fkey, 'branches', branchIndex, 'meta', key, k as keyof Argument, v as any)
    }

    const changedKeys = Object.keys(updates)
    if (changedKeys.length > 0) {
      for (let mIndex = 0; mIndex < branch.modules.length; mIndex++) {
        const mobj = branch.modules[mIndex]
        const cacheKey = dBind.uniqueKey('F', fkey, branch.key, mobj.key)
        const setFunc = flowStore.set.bind(
          null,
          fkey,
          'branches',
          branchIndex,
          'modules',
          mIndex,
          'arguments',
        )

        const virtualArg = { key } as any
        dBind.update(cacheKey, setFunc, mobj, virtualArg, changedKeys, f.meta, branch.meta)
      }
    }
  }

  const updateBranchMeta = (key: string, value: Argument) => {
    const branch = getSelectedBranch()
    if (!branch?.meta) {
      return
    }
    const oldValue = branch.meta[key]

    const updates: Partial<Argument> = {}
    if (oldValue) {
      for (const k of Object.keys(value) as (keyof Argument)[]) {
        if (value[k] !== oldValue[k]) {
          updates[k] = value[k] as any
        }
      }
    } else {
      Object.assign(updates, value)
    }

    if (Object.keys(updates).length > 0) {
      handleSetBranchMeta(key, updates)
    }
  }

  const deleteBranchMeta = (key: string) => {
    const branchIndex = getSelectedBranchIndex()
    const meta = getSelectedBranch()?.meta
    if (branchIndex === -1 || !meta) {
      return
    }
    const { [key]: _, ...rest } = meta
    flowStore.set(params.flow!, 'branches', branchIndex, { meta: rest })
  }

  const addBranchMeta = (
    key: string,
    dtype: ArgumentDType,
    method: ArgumentMethod | undefined,
    value: ArgumentValue,
  ) => {
    const branchIndex = getSelectedBranchIndex()
    const meta = getSelectedBranch()?.meta || {}
    if (branchIndex === -1) {
      return
    }
    const newAobj: Argument = { key, name: key, dtype, value }
    if (method) {
      newAobj.method = method
    }
    flowStore.set(params.flow!, 'branches', branchIndex, 'meta', { ...meta, [key]: newAobj })
  }

  const toggleModule = (moduleIndex: number) => {
    const branchIndex = getSelectedBranchIndex()
    if (branchIndex === -1) {
      return
    }
    const current = flow()?.branches[branchIndex].modules[moduleIndex].disabled
    flowStore.set(
      params.flow!,
      'branches',
      branchIndex,
      'modules',
      moduleIndex,
      'disabled',
      !current,
    )
  }

  const reloadBranch = async () => {
    const newFlow = await flowStore.fetch(params.flow!, true)
    const branch = getSelectedBranch()
    if (!newFlow || !branch) {
      return
    }

    const resolved = await resolveFlowBranch(branch, fetchProject)
    flowStore.set(newFlow.key, 'branches', getSelectedBranchIndex(), resolved)
  }

  onMount(() => {
    const branch = getSelectedBranch()
    if (!branch?.meta || Object.keys(branch.meta).length === 0) {
      reloadBranch()
    }
  })

  return (
    <Show
      when={flow()}
      fallback={<div class="flex items-center justify-center h-full text-gray-500">加载流...</div>}
    >
      <div class="flex flex-col">
        <FlowHeader flow={flow()!} onReload={reloadBranch} />

        {}
        <Show when={flow()!.desc}>
          <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
            <h3 class="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-4 mb-4">
              简介
            </h3>
            <NMarkdown content={flow()!.desc!} />
          </div>
        </Show>

        {}
        <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div class="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
            <h3 class="text-lg font-semibold text-gray-800">模块开关</h3>
            <select
              value={selectedBranch()}
              onChange={(e) => setSelectedBranch(e.currentTarget.value)}
              class="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
            >
              <For each={flow()!.branches}>
                {(branch) => <option value={branch.key}>{branch.name}</option>}
              </For>
            </select>
          </div>
          <div ref={scroll.ref} class="gap-2 pb-1">
            <For each={flow()!.branches.find((b) => b.key === selectedBranch())?.modules || []}>
              {(mod, i) => (
                <label class="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={!mod.disabled}
                    onChange={() => toggleModule(i())}
                    class="w-4 h-4 accent-green-200 hover:accent-green-300 text-green-500 rounded focus:ring-green-500"
                  />
                  <span class="text-sm text-gray-700">{mod.name || mod.key}</span>
                </label>
              )}
            </For>
          </div>
        </div>

        {}
        <div class="bg-white rounded-lg shadow-sm p-6 flex-1 flex flex-col gap-6">
          <MetaSection
            title="Meta"
            emptyText="流暂无 meta 配置"
            addTitle="添加 Flow 键值对"
            meta={flow()?.meta}
            onUpdate={updateFlowMeta}
            onDelete={deleteFlowMeta}
            onAdd={addFlowMeta}
          />

          <MetaSection
            title={`${selectedBranch()}分支 Meta`}
            emptyText="分支暂无 meta 配置"
            addTitle="添加 Branch 键值对"
            meta={getSelectedBranch()?.meta}
            onUpdate={updateBranchMeta}
            onDelete={deleteBranchMeta}
            onAdd={addBranchMeta}
            headerExtra={getSelectedBranch()?.name || selectedBranch()}
            bordered
          />
        </div>
      </div>
    </Show>
  )
}

export default FlowConfig
