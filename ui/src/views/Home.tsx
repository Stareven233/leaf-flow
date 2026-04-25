import { createSignal, onMount, onCleanup, For } from 'solid-js'
import { useAppNavigate } from '@/utils/routes'
import type { DirEntry } from '@/types/file'
import Card from '@/components/view/LeafCard'
import CardSection from '@/components/CardSection'
import ContextMenu from '@/components/ContextMenu'
import { useProjectStore } from '@/stores/project'
import { useFlowStore } from '@/stores/flow'
import { listEntries } from '@/apis/file'
import { fetchBaseProject, fetchBaseFlow } from '@/apis/project'
import { executeCommand } from '@/apis/execution'
import { saveConfigMTime, loadConfigMTime } from '@/utils/execution'
import { useConfigStore } from '@/stores/config'
import { useLazyLoad } from '@/utils/hooks/useLazyLoad'
import * as constants from '@/utils/constants'

export const yamlRegex = /\.(yaml|yml)$/i
export const flowYamlRegex = /\.flow\.(yaml|yml)$/i

function extractStemMTimeList(entries: DirEntry[], regex: RegExp): [string, number][] {
  const map: Record<string, { mtime: number; isYaml: boolean }> = {}
  for (const entry of entries) {
    if (entry.isDir || !regex.test(entry.name)) {
      continue
    }
    const stem = entry.name.replace(regex, '')
    const isYaml = entry.name.toLowerCase().endsWith('.yaml')
    const mtime = new Date(entry.mtime).getTime()
    const existing = map[stem]

    if (!existing || (isYaml && !existing.isYaml)) {
      map[stem] = { mtime, isYaml }
    }
  }
  return Object.entries(map).map(([k, v]) => [k, v.mtime])
}

export default function HomeView() {
  const navigate = useAppNavigate()
  const configStore = useConfigStore()
  const projectStore = useProjectStore()
  const flowStore = useFlowStore()

  const [itemMTime, setItemMTime] = createSignal<{
    project: Record<string, number>
    flow: Record<string, number>
  }>({
    project: {},
    flow: {},
  })

  const projectNames = () =>
    Object.entries(itemMTime().project)
      .sort((a, b) => b[1] - a[1])
      .map((v) => v[0])
  const flowNames = () =>
    Object.entries(itemMTime().flow)
      .sort((a, b) => b[1] - a[1])
      .map((v) => v[0])

  const [menuVisible, setMenuVisible] = createSignal(false)
  const [menuPos, setMenuPos] = createSignal({ x: 0, y: 0 })
  const [selectedMenu, setSelectedMenu] = createSignal('')
  const [menuType, setMenuType] = createSignal<'project' | 'flow'>('project')

  const projectLazy = useLazyLoad({
    getNames: projectNames,
    getItem: (k) => projectStore.get(k),
    fetchBatch: fetchBaseProject,
    loadItem: (p) => projectStore.load(p),
    batchSize: constants.CARD_BATCH_SIZE,
    logPrefix: 'Project',
  })

  const flowLazy = useLazyLoad({
    getNames: flowNames,
    getItem: (k) => flowStore.get(k),
    fetchBatch: fetchBaseFlow,
    loadItem: (f) => flowStore.load(f),
    batchSize: constants.CARD_BATCH_SIZE,
    logPrefix: 'Flow',
  })

  const initConfigMTime = async () => {
    await configStore.fetch(false)
    const config = configStore.data()
    if (!config) {
      return
    }
    const [projectEntries, flowEntries] = await Promise.all([
      listEntries(`${config.budDir}/leaf`),
      listEntries(`${config.budDir}/sprig`),
    ])

    try {
      const list = extractStemMTimeList(projectEntries, yamlRegex)
      const savedTime = loadConfigMTime('project')
      const newTime = Object.fromEntries(list.map(([k, v]) => [k, Math.max(savedTime[k] || 0, v)]))
      setItemMTime((prev) => ({ ...prev, project: newTime }))
      saveConfigMTime(newTime, 'project')
    } catch (e) {
      console.error('Failed to load projects:', e)
    }

    try {
      const list = extractStemMTimeList(flowEntries, flowYamlRegex)
      const savedTime = loadConfigMTime('flow')
      const newTime = Object.fromEntries(list.map(([k, v]) => [k, Math.max(savedTime[k] || 0, v)]))
      setItemMTime((prev) => ({ ...prev, flow: newTime }))
      saveConfigMTime(newTime, 'flow')
    } catch (e) {
      console.error('Failed to load flows:', e)
    }
  }

  const openProject = (pkey: string, mkey?: string) => {
    navigate('project', pkey, mkey, { state: 'first-choice' })
    setItemMTime((prev) => {
      const updated = { ...prev.project, [pkey]: Date.now() }
      saveConfigMTime(updated, 'project')
      return { ...prev, project: updated }
    })
  }

  const openFlow = (fkey: string, bkey?: string) => {
    navigate('flow', fkey, bkey, { state: 'first-choice' })
    setItemMTime((prev) => {
      const updated = { ...prev.flow, [fkey]: Date.now() }
      saveConfigMTime(updated, 'flow')
      return { ...prev, flow: updated }
    })
  }

  const showContextMenu = (e: MouseEvent, name: string, type: 'project' | 'flow' = 'project') => {
    e.preventDefault()
    setMenuVisible(true)
    setMenuPos({ x: e.clientX, y: e.clientY })
    setSelectedMenu(name)
    setMenuType(type)
  }

  const closeContextMenu = () => setMenuVisible(false)

  const openExternalEditor = async (name: string, type: 'project' | 'flow') => {
    const config = configStore.data()
    if (!config) {
      return
    }
    const path =
      type === 'flow'
        ? `${config.budDir}/sprig/${name}.flow.yaml`
        : `${config.budDir}/leaf/${name}.yaml`
    executeCommand([`Start-Process ${path}`], 'ps')
  }

  const togglePin = (name: string, type: 'project' | 'flow') => {
    const mtime = itemMTime()[type][name]!
    const isPinned = mtime >= constants.BIG_NUMBER
    setItemMTime((prev) => {
      const updated = { ...prev[type], [name]: mtime + (isPinned ? -1 : 1) * constants.BIG_NUMBER }
      saveConfigMTime(updated, type)
      return { ...prev, [type]: updated }
    })
    closeContextMenu()
  }

  const menuItems = () => {
    const name = selectedMenu()
    const type = menuType()
    const mtime = itemMTime()[type][name]!
    const isPinned = mtime >= constants.BIG_NUMBER

    if (type === 'flow') {
      return [
        {
          label: '进入',
          onClick: () => {
            openFlow(name)
            closeContextMenu()
          },
        },
        {
          label: '配置',
          onClick: () => {
            navigate('flow', name)
            closeContextMenu()
          },
        },
        { label: '外部编辑', onClick: () => openExternalEditor(name, 'flow') },
        { label: isPinned ? '取消置顶' : '置顶', onClick: () => togglePin(name, 'flow') },
      ]
    }

    return [
      {
        label: '进入',
        onClick: () => {
          openProject(name)
          closeContextMenu()
        },
      },
      {
        label: '配置',
        onClick: () => {
          navigate('project', name)
          closeContextMenu()
        },
      },
      { label: '外部编辑', onClick: () => openExternalEditor(name, 'project') },
      { label: isPinned ? '取消置顶' : '置顶', onClick: () => togglePin(name, 'project') },
    ]
  }

  onMount(() => {
    initConfigMTime()
    projectLazy.init()
    flowLazy.init()
    window.addEventListener('click', closeContextMenu)
  })

  onCleanup(() => {
    projectLazy.destroy()
    flowLazy.destroy()
    window.removeEventListener('click', closeContextMenu)
  })

  return (
    <div class="w-full px-4 my-auto flex flex-col gap-8">
      {}
      <CardSection title="项目" hasItems={projectNames().length > 0} emptyText="未找到项目">
        <For each={projectNames()}>
          {(name) => (
            <Card
              ref={(el) => projectLazy.registerRef(el, name)}
              name={name}
              data={projectStore.get(name)}
              error={projectLazy.isFailed(name)}
              tags={projectStore.get(name)?.modules}
              onClick={openProject}
              onContextMenu={(e) => showContextMenu(e, name)}
            />
          )}
        </For>
      </CardSection>

      {}
      <CardSection title="流" hasItems={flowNames().length > 0}>
        <For each={flowNames()}>
          {(name) => (
            <Card
              ref={(el) => flowLazy.registerRef(el, name)}
              name={name}
              data={flowStore.get(name)}
              error={flowLazy.isFailed(name)}
              tags={flowStore.get(name)?.branches}
              onClick={openFlow}
              onContextMenu={(e) => showContextMenu(e, name, 'flow')}
            />
          )}
        </For>
      </CardSection>

      {}
      <ContextMenu visible={menuVisible()} x={menuPos().x} y={menuPos().y} items={menuItems()} />
    </div>
  )
}
