import { createSignal } from 'solid-js'
import { useLocation } from '@solidjs/router'
import { useAppNavigate } from '@/utils/routes'
import type { Flow, SavedArgument, ArgumentMap } from '@/types/project'
import NButton from '@/components/common/NButton'
import ExportDialog from '@/components/ExportDialog'
import ExecutionHistoryDropdown from '@/components/ExecutionHistoryDropdown'
import { RefreshIcon, ExportIcon, GearIcon } from '@/components/common/Icons'
import { useFlowStore } from '@/stores/flow'
import { useConfigStore } from '@/stores/config'
import { createEntry } from '@/apis/file'
import { exportFile, toYaml } from '@/utils/config'
import { useScroll } from '@/utils/hooks/useScroll'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import { join as pathJoin } from '@/utils/path'

interface FlowHeaderProps {
  flow: Flow
  onReload?: () => void | Promise<void>
}

export default function FlowHeader(props: FlowHeaderProps) {
  const navigate = useAppNavigate()
  const location = useLocation()
  const params = useDecodedParams()
  const flowStore = useFlowStore()
  const configStore = useConfigStore()
  const scroll = useScroll()

  const [showExportDialog, setShowExportDialog] = createSignal(false)
  const [yamlName, setYamlName] = createSignal('')

  const isOnFlowRoot = () =>
    decodeURIComponent(location.pathname).startsWith(`/flows/${props.flow.key}`) && !params.branch

  const configButtonName = () => (isOnFlowRoot() ? '返回' : '配置')

  const toggleConfigPage = () => {
    if (isOnFlowRoot()) {
      const state = location.state as { branch?: string } | null
      const branch = state?.branch
      const flow = flowStore.get(props.flow.key)
      if (flow && flow.branches.length > 0) {
        const target =
          branch && flow.branches.find((b) => b.key === branch) ? branch : flow.branches[0].key
        navigate('flow', props.flow.key, target)
      }
      return
    }
    navigate('flow', props.flow.key, undefined, { state: { branch: params.branch } })
  }

  const restoreExecutionHistory = (item: SavedArgument) => {
    if (item.type !== 'flow') {
      return
    }
    const { subKey, map } = item
    const flow = flowStore.get(props.flow.key)
    if (!flow) {
      return
    }

    const bIndex = flow.branches.findIndex((b) => b.key === subKey)
    if (bIndex === -1) {
      return
    }

    const branch = flow.branches[bIndex]
    const maps = map as Record<string, ArgumentMap>
    branch.modules.forEach((module, mIndex) => {
      const mmap = maps[module.key]
      if (!mmap || !module.arguments) {
        return
      }
      module.arguments.forEach((arg, argIndex) => {
        const v = mmap[arg.key]
        if (v === undefined) {
          return
        }
        flowStore.set(
          props.flow.key,
          'branches',
          bIndex,
          'modules',
          mIndex,
          'arguments',
          argIndex,
          'value',
          v,
        )
      })
    })

    console.log(`Restore arguments for flow branch ${subKey}`)
    navigate('flow', props.flow.key, subKey!)
  }

  const exportConfig = () => {
    setYamlName(props.flow.key)
    setShowExportDialog(true)
  }

  const confirmExport = async (action: 'export' | 'save' = 'export', dir?: string) => {
    let fileName = yamlName().trim()
    if (!fileName) return
    if (!['.yaml', '.yml'].some((ext) => fileName.endsWith(ext))) {
      fileName += '.flow.yaml'
    }
    const yamlString = toYaml(props.flow as any)
    if (action === 'export') {
      exportFile(fileName, yamlString)
    } else {
      const configData = configStore.data()
      const p = pathJoin(configData?.budDir || './leaf', dir || '', fileName)
      await createEntry(p, false, yamlString, true)
    }
    setShowExportDialog(false)
  }

  return (
    <>
      <header class="w-full bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-row justify-between items-center gap-4">
        <h2 class="text-xl font-semibold text-gray-800">{props.flow.name}</h2>
        <div class="flex items-center gap-3 min-w-10">
          <div ref={scroll.ref} class="flex items-center gap-3 overflow-x-auto shrink min-w-10">
            <NButton onClick={props.onReload} variant="secondary">
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
          <div class="shrink-0">
            <ExecutionHistoryDropdown
              type="flow"
              key={props.flow.key}
              restoreFunc={restoreExecutionHistory}
            />
          </div>
        </div>
      </header>

      <ExportDialog
        visible={showExportDialog()}
        title="保存配置"
        prompt="请输入要保存的配置文件名"
        placeholder="例如：taffy.flow.yaml"
        filename={yamlName()}
        dirOptions={['flow', '<no>']}
        onFilenameChange={setYamlName}
        onCancel={() => setShowExportDialog(false)}
        onConfirm={confirmExport}
      />
    </>
  )
}
