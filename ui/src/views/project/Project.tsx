import { onMount, onCleanup, createEffect, on, Show, For } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { useProjectStore } from '@/stores/project'
import ProjectHeader from '@/components/view/ProjectHeader'
import ModuleTabs from '@/components/view/ModuleTabs'
import { ArgumentRow } from '@/components/argumentInput'
import * as exec from '@/utils/execution'
import type { Module, Project, Argument, ArgumentMap, ArgumentSetter } from '@/types/project'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { useStickyBottom } from '@/utils/hooks/useStickyBottom'
import { useCommandExecution } from '@/utils/hooks/useCommandExecution'
import ExecuteActionBar from '@/components/ExecuteActionBar'
import { NMarkdown } from '@/components/common/NMarkdown'
import dBind from '@/utils/dynamicBind'

function useArgumentManager(
  getProject: () => Project | undefined,
  getModule: () => Module | null,
  getProjectKey: () => string,
  setProject: SetStoreFunction<Record<string, Project>>,
) {
  const loadTempArgs = () => {
    const project = getProject()
    const module = getModule()
    if (!project || !module) {
      return
    }

    const tempMap = exec.loadTemporaryArgument('project', project.key, module.key) as ArgumentMap
    if (!tempMap) {
      return
    }

    const modIndex = project.modules.findIndex((m) => m.key === module.key)
    if (modIndex === -1) {
      return
    }

    const projectKey = getProjectKey()
    module.arguments?.forEach((arg, aIndex) => {
      const value = tempMap[arg.key]
      setProject(projectKey, 'modules', modIndex, 'arguments', aIndex, 'value', value)
    })
  }

  const saveTempArgs = () => {
    const project = getProject()
    const module = getModule()
    if (!project || !module) {
      return
    }

    const rmap = exec.gatherArgumentStatus(module.arguments || [], undefined, false)
    const rawMap = exec.fromRenderMap(rmap, 'rawValue')
    exec.saveTemporaryArgument('project', project.key, module.key, rawMap)
  }

  const clearTempArgs = () => {
    const project = getProject()
    const module = getModule()
    if (project && module) {
      exec.clearTemporaryArgument('project', project.key, module.key)
    }
  }

  return {
    loadTempArgs,
    saveTempArgs,
    clearTempArgs,
  }
}

function useModuleExecution(getProject: () => Project | undefined, getModule: () => Module | null) {
  const cmdExec = useCommandExecution()

  const buildCommands = () => {
    const module = getModule()
    const project = getProject()
    if (!module || !project) return []

    const rmap = exec.gatherArgumentStatus(module.arguments, project.meta, true)
    const templates = Array.isArray(module.template) ? module.template : [module.template]
    return templates.map((t) => exec.renderCommand(t, rmap))
  }

  const previewModule = () => {
    cmdExec.preview(buildCommands())
  }

  const executeModule = async () => {
    const mod = getModule()
    const project = getProject()
    if (!mod || !project) {
      return
    }
    const valid = exec.validateRequiredArguments(mod.arguments, true)
    if (!valid) {
      return
    }
    const rmap = exec.gatherArgumentStatus(mod.arguments, project.meta, true)
    const templates = Array.isArray(mod.template) ? mod.template : [mod.template]
    const commands = templates.map((t) => exec.renderCommand(t, rmap))
    const rawMap = exec.fromRenderMap(rmap, 'rawValue')
    exec.saveTemporaryArgument('project', project.key, mod.key, rawMap)

    await cmdExec.execute(commands, mod.shell || 'auto', () => {
      exec.saveExecutedArgument('project', project.key, mod.key, rawMap)
    })
  }

  return {
    ...cmdExec,
    previewModule,
    executeModule,
  }
}

export default function ProjectView() {
  const params = useDecodedParams()
  const projectStore = useProjectStore()

  const getProjectKey = () => params.project!
  const getProject = () => {
    const key = getProjectKey()
    return key ? projectStore.get(key) : undefined
  }
  const getModule = () => {
    const name = params.module
    const project = getProject()
    if (!project) {
      return null
    }
    return project.modules.find((m) => m.key === name) || null
  }
  const getModuleIndex = () => {
    const project = getProject()
    const module = getModule()
    if (!project || !module) {
      return -1
    }
    return project.modules.findIndex((m) => m.key === module.key)
  }

  const {
    actionSectionRef,
    sentinelRef,
    isSticky,
    sectionHeight,
    initObservers,
    cleanupObservers,
  } = useStickyBottom()

  const { loadTempArgs, saveTempArgs, clearTempArgs } = useArgumentManager(
    getProject,
    getModule,
    getProjectKey,
    projectStore.set,
  )

  const {
    isExecuting,
    executionInfo,
    executeModule,
    previewCommands,
    setPreviewCommands,
    previewModule,
  } = useModuleExecution(getProject, getModule)

  onMount(() => {
    loadTempArgs()
    initObservers()
    window.addEventListener('beforeunload', saveTempArgs)
  })

  createEffect(
    on(
      () => params.module,
      () => {
        setPreviewCommands([])
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    saveTempArgs()
    window.removeEventListener('beforeunload', saveTempArgs)
    cleanupObservers()
  })

  const handleSetArgument = (aIndex: number, updates: Partial<Argument>) => {
    const mIndex = getModuleIndex()
    if (mIndex === -1) {
      return
    }
    const pkey = getProjectKey()
    const mobj = getModule()
    const aobj = mobj?.arguments?.[aIndex]
    if (!aobj) {
      return
    }

    const _set: ArgumentSetter = projectStore.set.bind(null, pkey, 'modules', mIndex, 'arguments')
    for (const [key, val] of Object.entries(updates)) {
      _set(aIndex, key as keyof Argument, val)
    }
    const key = dBind.uniqueKey('P', pkey, mobj.key)
    dBind.update(key, _set, mobj, aobj, Object.keys(updates))
  }

  return (
    <div class="w-full mx-auto">
      <Show when={getProject()}>{(project) => <ProjectHeader project={project()} />}</Show>

      <section class="p-6 bg-white rounded-lg shadow-sm">
        <Show when={getProject()}>{(project) => <ModuleTabs modules={project().modules} />}</Show>

        {}
        <div class="mt-2 mb-6 p-4 bg-green-50 rounded-md">
          {}
          <NMarkdown content={getModule()?.desc || '暂无模块'} />
        </div>

        {}
        <div class="space-y-2 bg-white">
          <For each={getModule()?.arguments}>
            {(argument, index) => (
              <ArgumentRow
                argument={argument}
                setArgument={(updates) => handleSetArgument(index(), updates)}
              />
            )}
          </For>
        </div>
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
        onPreview={previewModule}
        onExecute={executeModule}
        onClosePreview={() => setPreviewCommands([])}
      />
    </div>
  )
}
