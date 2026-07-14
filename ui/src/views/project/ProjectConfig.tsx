import { Component, Show, For } from 'solid-js'
import { useProjectStore } from '@/stores/project'
import ProjectHeader from '@/components/view/ProjectHeader'
import { MetaSection } from '@/components/view/ModuleMeta'
import NMarkdown from '@/components/common/NMarkdown'
import type { ArgumentValue, ArgumentDType, ArgumentMethod, Argument } from '@/types/project'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { useScroll } from '@/utils/hooks/useScroll'
import dBind from '@/utils/dynamicBind'

const ProjectConfig: Component = () => {
  const params = useDecodedParams()
  const scroll = useScroll()
  const projectStore = useProjectStore()
  const project = () => projectStore.get(params.project!)

  const handleSetMeta = (key: string, updates: Partial<Argument>) => {
    const proj = project()
    if (!proj?.meta) {
      return
    }
    const pkey = params.project!

    for (const [k, v] of Object.entries(updates)) {
      projectStore.set(pkey, 'meta', key, k as keyof Argument, v as any)
    }

    const changedKeys = Object.keys(updates)
    if (changedKeys.length > 0) {
      for (let mIndex = 0; mIndex < proj.modules.length; mIndex++) {
        const mobj = proj.modules[mIndex]
        const cacheKey = dBind.uniqueKey('P', pkey, mobj.key)

        const setFunc = projectStore.set.bind(null, pkey, 'modules', mIndex, 'arguments')

        const virtualArg = { key } as any
        const latestProj = project()
        dBind.update(cacheKey, setFunc, mobj, virtualArg, changedKeys, latestProj?.meta)
      }
    }
  }

  const updateMeta = (key: string, val: Argument) => {
    const proj = project()
    if (!proj?.meta) {
      return
    }
    const oldValue = proj.meta[key]

    const updates: Partial<Argument> = {}
    if (oldValue) {
      for (const k of Object.keys(val) as (keyof Argument)[]) {
        if (val[k] !== oldValue[k]) {
          updates[k] = val[k] as any
        }
      }
    } else {
      Object.assign(updates, val)
    }

    if (Object.keys(updates).length > 0) {
      handleSetMeta(key, updates)
    }
  }

  const deleteMeta = (key: string) => {
    const proj = project()
    if (!proj || !proj.meta) {
      return
    }
    const { [key]: _, ...rest } = proj.meta
    projectStore.set(params.project!, { meta: rest })
  }

  const addMeta = (
    key: string,
    dtype: ArgumentDType,
    method: ArgumentMethod | undefined,
    value: ArgumentValue,
  ) => {
    const meta = project()?.meta || {}
    const newAobj: Argument = { key, name: key, dtype, value }
    if (method) {
      newAobj.method = method
    }
    projectStore.set(params.project!, 'meta', { ...meta, [key]: newAobj })
  }

  const toggleModule = (index: number) => {
    const proj = project()
    if (!proj) return
    const current = proj.modules[index].disabled
    projectStore.set(params.project!, 'modules', index, 'disabled', !current)
  }

  return (
    <Show
      when={project()}
      fallback={
        <div class="flex items-center justify-center h-full text-gray-500">加载项目...</div>
      }
    >
      <div class="flex flex-col">
        <ProjectHeader project={project()!} />

        {}
        <Show when={project()!.desc}>
          <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
            <h3 class="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-4 mb-4">
              简介
            </h3>
            <NMarkdown content={project()!.desc!} />
          </div>
        </Show>

        {}
        <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h3 class="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-4 mb-4">
            模块开关
          </h3>
          <div ref={scroll.ref} class="gap-2 pb-1">
            <For each={project()!.modules}>
              {(m, i) => (
                <label class="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={!m.disabled}
                    onChange={() => toggleModule(i())}
                    class="w-4 h-4 accent-green-200 hover:accent-green-300 text-green-500 rounded focus:ring-green-500"
                  />
                  <span class="text-sm text-gray-700">{m.name}</span>
                </label>
              )}
            </For>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm p-6 flex flex-col gap-6">
          <MetaSection
            title="Meta"
            emptyText="项目暂无 meta 配置"
            addTitle="添加新键值对"
            meta={project()?.meta}
            onUpdate={updateMeta}
            onDelete={deleteMeta}
            onAdd={addMeta}
          />
        </div>
      </div>
    </Show>
  )
}

export default ProjectConfig
