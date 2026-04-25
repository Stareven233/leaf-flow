import { createSignal } from 'solid-js'
import { useLocation } from '@solidjs/router'
import { useAppNavigate } from '@/utils/routes'
import type { Project, SavedArgument, ArgumentMap } from '@/types/project'
import NButton from '@/components/common/NButton'
import ExecutionHistoryDropdown from '@/components/ExecutionHistoryDropdown'
import ExportDialog from '@/components/ExportDialog'
import { RefreshIcon, ExportIcon, GearIcon } from '@/components/common/Icons'
import { useProjectStore } from '@/stores/project'
import { useConfigStore } from '@/stores/config'
import { createEntry } from '@/apis/file'
import { exportFile, toYaml } from '@/utils/config'
import { useScroll } from '@/utils/hooks/useScroll'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { join as pathJoin } from '@/utils/path'

const YAML_EXTENSIONS = ['.yaml', '.yml'] as const
const DEFAULT_YAML_EXT = '.yaml'

interface ProjectHeaderProps {
  project: Project
}

export default function ProjectHeader(props: ProjectHeaderProps) {
  const navigate = useAppNavigate()
  const location = useLocation()
  const params = useDecodedParams()
  const projectStore = useProjectStore()
  const configStore = useConfigStore()
  const scroll = useScroll()

  const [showExportDialog, setShowExportDialog] = createSignal(false)
  const [yamlName, setYamlName] = createSignal('')

  const reload = () => projectStore.fetch(props.project.key, undefined, true)

  const isOnProjectRoot = () => {
    return (
      decodeURIComponent(location.pathname).startsWith(`/projects/${props.project.key}`) &&
      !params.module
    )
  }

  const configButtonName = () => (isOnProjectRoot() ? '返回' : '配置')

  const toggleConfigPage = () => {
    if (isOnProjectRoot()) {
      const state = location.state as { module?: string } | null
      const mname = state?.module
      const project = projectStore.get(props.project.key)
      if (project && project.modules.length > 0) {
        const target =
          mname && project.modules.find((m) => m.key === mname) ? mname : project.modules[0].key
        navigate('project', props.project.key, target)
      }
      return
    }
    navigate('project', props.project.key, undefined, { state: { module: params.module } })
  }

  const exportConfig = () => {
    if (!props.project) {
      return
    }
    setYamlName(props.project.key)
    setShowExportDialog(true)
  }

  const confirmExport = async (action: 'export' | 'save' = 'export', dir?: string) => {
    if (!props.project) {
      setShowExportDialog(false)
      return
    }
    let fileName = yamlName().trim()
    if (!fileName) {
      return
    }
    if (!YAML_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
      fileName += DEFAULT_YAML_EXT
    }
    const yamlString = toYaml(props.project)
    if (action === 'export') {
      exportFile(fileName, yamlString)
    } else {
      const configData = configStore.data()
      const p = pathJoin(configData?.budDir || './leaf', dir || '', fileName)
      await createEntry(p, false, yamlString, true)
    }
    setShowExportDialog(false)
  }

  const restoreExecutionHistory = (item: SavedArgument) => {
    if (item.type !== 'project') {
      return
    }
    const { key, subKey, map } = item
    const project = projectStore.get(key)
    if (!project) {
      return
    }

    const mIndex = project.modules.findIndex((m) => m.key === subKey)
    if (mIndex === -1 || !project.modules[mIndex].arguments) {
      return
    }

    const argMap = map as ArgumentMap
    project.modules[mIndex].arguments.forEach((arg, index) => {
      const v = argMap[arg.key]
      if (v === undefined) {
        return
      }
      projectStore.set(key, 'modules', mIndex, 'arguments', index, 'value', v)
    })

    console.log(`Restore arguments for module ${key}.${subKey}`)
    navigate('project', key, subKey!)
  }

  return (
    <>
      <header class="w-full bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-row justify-between items-center gap-4">
        <h2 class="text-xl font-semibold text-gray-800">{props.project.name}</h2>
        <div class="flex items-center gap-3 min-w-10">
          <div ref={scroll.ref} class="flex items-center gap-3 overflow-x-auto shrink min-w-10">
            <NButton onClick={reload} variant="secondary">
              <RefreshIcon class="mr-2" />
              还原
            </NButton>
            <NButton onClick={exportConfig} variant="secondary">
              <ExportIcon class="mr-2" />
              保存
            </NButton>
            <NButton onClick={toggleConfigPage} variant="secondary">
              <GearIcon class="mr-2 text-gray-500" />
              {configButtonName()}
            </NButton>
          </div>
          {}
          <div class="shrink-0">
            <ExecutionHistoryDropdown
              type="project"
              key={props.project.key}
              restoreFunc={restoreExecutionHistory}
            />
          </div>
        </div>
      </header>

      <ExportDialog
        visible={showExportDialog()}
        title="保存配置"
        prompt="请输入要保存的配置文件名"
        placeholder="例如：taffy.yaml"
        filename={yamlName()}
        dirOptions={['base', '<no>']}
        onFilenameChange={setYamlName}
        onCancel={() => setShowExportDialog(false)}
        onConfirm={confirmExport}
      />
    </>
  )
}
