import { createSignal, createMemo, createEffect, on, onMount, onCleanup, For, Show } from 'solid-js'
import { useAppNavigate } from '@/utils/routes'
import type { DirEntry } from '@/types/file'
import Card from '@/components/view/LeafCard'
import CardSection, { CARD_GRID_CLASS } from '@/components/CardSection'
import ContextMenu from '@/components/ContextMenu'
import { useProjectStore } from '@/stores/project'
import { useFlowStore } from '@/stores/flow'
import { listEntries } from '@/apis/file'
import { fetchBaseProject, fetchBaseFlow } from '@/apis/project'
import { executeCommand } from '@/apis/execution'
import { saveConfigMTime, loadConfigMTime } from '@/utils/execution'
import { useConfigStore } from '@/stores/config'
import { useLazyLoad } from '@/utils/hooks/useLazyLoad'
import { useGridColumns } from '@/utils/hooks/useGridColumns'
import * as constants from '@/utils/constants'
import { isPinned, nextOpenMTime, matchName } from '@/utils/homeList'
import { Search, X } from 'lucide-solid'

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

  const projectNames = createMemo(() =>
    Object.entries(itemMTime().project)
      .sort((a, b) => b[1] - a[1])
      .map((v) => v[0]),
  )
  const flowNames = createMemo(() =>
    Object.entries(itemMTime().flow)
      .sort((a, b) => b[1] - a[1])
      .map((v) => v[0]),
  )

  const [draftQuery, setDraftQuery] = createSignal('')
  const [activeQuery, setActiveQuery] = createSignal('')

  const filtering = createMemo(() => activeQuery().trim().length > 0)

  const filteredProjectNames = createMemo(() => {
    const all = projectNames()
    if (!filtering()) {
      return all
    }
    const q = activeQuery()
    return all.filter((n) => matchName(n, q, projectStore.get(n)?.name))
  })
  const filteredFlowNames = createMemo(() => {
    const all = flowNames()
    if (!filtering()) {
      return all
    }
    const q = activeQuery()
    return all.filter((n) => matchName(n, q, flowStore.get(n)?.name))
  })

  const gridProbe = useGridColumns()
  const pageSize = createMemo(() => Math.max(1, gridProbe.columns() * constants.CARD_PAGE_ROWS))

  const [projectPage, setProjectPage] = createSignal(1)
  const [flowPage, setFlowPage] = createSignal(1)

  const projectPageCount = createMemo(() =>
    Math.max(1, Math.ceil(filteredProjectNames().length / pageSize())),
  )
  const flowPageCount = createMemo(() =>
    Math.max(1, Math.ceil(filteredFlowNames().length / pageSize())),
  )

  const pagedProjectNames = createMemo(() => {
    const start = (projectPage() - 1) * pageSize()
    return filteredProjectNames().slice(start, start + pageSize())
  })
  const pagedFlowNames = createMemo(() => {
    const start = (flowPage() - 1) * pageSize()
    return filteredFlowNames().slice(start, start + pageSize())
  })

  createEffect(
    on(activeQuery, () => {
      setProjectPage(1)
      setFlowPage(1)
    }),
  )
  createEffect(() => {
    const count = projectPageCount()
    if (count < projectPage()) {
      setProjectPage(count)
    }
  })
  createEffect(() => {
    const count = flowPageCount()
    if (count < flowPage()) {
      setFlowPage(count)
    }
  })

  const [menuVisible, setMenuVisible] = createSignal(false)
  const [menuPos, setMenuPos] = createSignal({ x: 0, y: 0 })
  const [selectedMenu, setSelectedMenu] = createSignal('')
  const [menuType, setMenuType] = createSignal<'project' | 'flow'>('project')

  let projectSectionEl: HTMLElement | undefined
  let flowSectionEl: HTMLElement | undefined

  const projectLazy = useLazyLoad({
    getNames: () => filteredProjectNames(),
    getItem: (k) => projectStore.get(k),
    fetchBatch: fetchBaseProject,
    loadItem: (p) => projectStore.load(p),
    batchSize: constants.CARD_BATCH_SIZE,
    logPrefix: 'Project',
  })

  const flowLazy = useLazyLoad({
    getNames: () => filteredFlowNames(),
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
      const updated = { ...prev.project, [pkey]: nextOpenMTime(prev.project[pkey] ?? 0) }
      saveConfigMTime(updated, 'project')
      return { ...prev, project: updated }
    })
  }

  const openFlow = (fkey: string, bkey?: string) => {
    navigate('flow', fkey, bkey, { state: 'first-choice' })
    setItemMTime((prev) => {
      const updated = { ...prev.flow, [fkey]: nextOpenMTime(prev.flow[fkey] ?? 0) }
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
    const pinned = isPinned(mtime)
    setItemMTime((prev) => {
      const updated = { ...prev[type], [name]: mtime + (pinned ? -1 : 1) * constants.BIG_NUMBER }
      saveConfigMTime(updated, type)
      return { ...prev, [type]: updated }
    })
    closeContextMenu()
  }

  const menuItems = () => {
    const name = selectedMenu()
    const type = menuType()
    const mtime = itemMTime()[type][name]!
    const pinned = isPinned(mtime)

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
        { label: pinned ? '取消置顶' : '置顶', onClick: () => togglePin(name, 'flow') },
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
      { label: pinned ? '取消置顶' : '置顶', onClick: () => togglePin(name, 'project') },
    ]
  }

  const commitSearch = () => {
    setActiveQuery(draftQuery().trim())
  }

  const clearSearch = () => {
    setDraftQuery('')
    setActiveQuery('')
  }

  const onSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') {
      return
    }
    if (e.isComposing || e.keyCode === 229) {
      return
    }
    e.preventDefault()
    commitSearch()
  }

  const scrollToSection = (el: HTMLElement | undefined) => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const projectCountLabel = createMemo(() => {
    const all = projectNames().length
    const filtered = filteredProjectNames().length
    if (filtering()) {
      return `${filtered}/${all}`
    }
    return all ? String(all) : undefined
  })
  const flowCountLabel = createMemo(() => {
    const all = flowNames().length
    const filtered = filteredFlowNames().length
    if (filtering()) {
      return `${filtered}/${all}`
    }
    return all ? String(all) : undefined
  })
  const projectFilterNoMatch = createMemo(
    () => filtering() && projectNames().length > 0 && filteredProjectNames().length === 0,
  )
  const flowFilterNoMatch = createMemo(
    () => filtering() && flowNames().length > 0 && filteredFlowNames().length === 0,
  )

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
    <div class="w-full my-auto flex flex-col gap-6">
      {}
      <div
        ref={gridProbe.ref}
        aria-hidden="true"
        class={`${CARD_GRID_CLASS} h-0 overflow-hidden`}
      />

      {}
      <div class="bg-white rounded-lg shadow px-4 py-3 flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-48 max-w-md">
          <Search
            size={16}
            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="search"
            class="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-200 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            placeholder="按名称搜索，回车过滤…"
            value={draftQuery()}
            onInput={(e) => setDraftQuery(e.currentTarget.value)}
            onKeyDown={onSearchKeyDown}
            aria-label="按名称搜索"
          />
          <Show when={draftQuery() || filtering()}>
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              onClick={clearSearch}
              aria-label="清除搜索"
              title="清除"
            >
              <X size={14} />
            </button>
          </Show>
        </div>

        <Show when={filtering()}>
          <span class="text-sm text-gray-500">
            已过滤「{activeQuery()}」· 项目 {filteredProjectNames().length}/{projectNames().length}
            {flowNames().length > 0
              ? ` · 流 ${filteredFlowNames().length}/${flowNames().length}`
              : ''}
          </span>
        </Show>

        <nav class="flex items-center gap-2 ml-auto text-sm">
          <button
            type="button"
            class="px-2 py-1 text-green-600 hover:bg-green-50 rounded"
            onClick={() => scrollToSection(projectSectionEl)}
          >
            项目
          </button>
          <button
            type="button"
            class="px-2 py-1 text-green-600 hover:bg-green-50 rounded"
            onClick={() => scrollToSection(flowSectionEl)}
          >
            流
          </button>
        </nav>
      </div>

      {}
      <CardSection
        title="项目"
        hasItems={filteredProjectNames().length > 0}
        emptyText="未找到项目"
        noMatchText={`无匹配「${activeQuery()}」`}
        filterNoMatch={projectFilterNoMatch()}
        countLabel={projectCountLabel()}
        pager={{ page: projectPage(), pageCount: projectPageCount(), onPage: setProjectPage }}
        sectionRef={(el) => {
          projectSectionEl = el
        }}
      >
        <For each={pagedProjectNames()}>
          {(name) => (
            <Card
              ref={(el) => {
                projectLazy.registerRef(el, name)
                onCleanup(() => projectLazy.unregisterRef(el))
              }}
              name={name}
              data={projectStore.get(name)}
              error={projectLazy.isFailed(name)}
              tags={projectStore.get(name)?.modules}
              pinned={isPinned(itemMTime().project[name] ?? 0)}
              onClick={openProject}
              onContextMenu={(e) => showContextMenu(e, name)}
            />
          )}
        </For>
      </CardSection>

      {}
      <CardSection
        title="流"
        hasItems={filteredFlowNames().length > 0}
        noMatchText={`无匹配「${activeQuery()}」`}
        filterNoMatch={flowFilterNoMatch()}
        countLabel={flowCountLabel()}
        pager={{ page: flowPage(), pageCount: flowPageCount(), onPage: setFlowPage }}
        sectionRef={(el) => {
          flowSectionEl = el
        }}
      >
        <For each={pagedFlowNames()}>
          {(name) => (
            <Card
              ref={(el) => {
                flowLazy.registerRef(el, name)
                onCleanup(() => flowLazy.unregisterRef(el))
              }}
              name={name}
              data={flowStore.get(name)}
              error={flowLazy.isFailed(name)}
              tags={flowStore.get(name)?.branches}
              pinned={isPinned(itemMTime().flow[name] ?? 0)}
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
