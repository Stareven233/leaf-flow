import {
  type Component,
  createSignal,
  createMemo,
  createEffect,
  For,
  Show,
  onCleanup,
} from 'solid-js'
import type { DirEntry } from '@/types/file'
import { listEntries, createEntry } from '@/apis/file'
import NButton from '../common/NButton'
import NCheckbox from '../common/NCheckbox'
import {
  DeleteIcon,
  SimpleArrowLeftIcon,
  SimpleArrowRightIcon,
  FileIcon,
  DirectoryIcon,
  CircleLoadingIcon,
} from '@/components/common/Icons'
import { useScroll } from '@/utils/hooks/useScroll'
import { executeCommand } from '@/apis/execution'
import { join as pathJoin } from '@/utils/path'

interface FileBrowserProps {
  visible: boolean
  type: 'file' | 'directory'
  multiple?: boolean
  currentDir: string
  onCurrentDirChange: (dir: string) => void
  onCancel: () => void
  onConfirm: (files: string[]) => void
}

const FileBrowser: Component<FileBrowserProps> = (props) => {
  const [currentDirItems, setCurrentDirItems] = createSignal<DirEntry[]>([])
  const [selectedItems, setSelectedItems] = createSignal<string[]>([])
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [history, setHistory] = createSignal<string[]>([])
  const [sortBy, setSortBy] = createSignal<'name' | 'size' | 'mtime'>('name')
  const [sortOrder, setSortOrder] = createSignal<'asc' | 'desc'>('asc')
  const [contextMenu, setContextMenu] = createSignal<{ x: number; y: number } | null>(null)
  const [inputMode, setInputMode] = createSignal<'file' | 'folder' | null>(null)
  const [inputValue, setInputValue] = createSignal('')
  const selectable = (item: DirEntry) =>
    (props.type !== 'directory' && !item.isDir) || (props.type === 'directory' && item.isDir)
  const scroll = useScroll()

  const pathSegments = createMemo(() => {
    return props.currentDir
      .replace(/\\/g, '/')
      .split('/')
      .filter((segment) => segment)
  })

  const canNavigateBack = createMemo(() => {
    return history().length > 0
  })

  const canNavigateUp = createMemo(() => {
    return pathSegments().length > 0
  })

  const sortedItems = createMemo(() => {
    const items = [...currentDirItems()]
    const by = sortBy()
    const order = sortOrder()
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return order === 'asc' ? (a.isDir ? 1 : -1) : a.isDir ? -1 : 1
      let cmp = 0
      if (by === 'name') cmp = a.name.localeCompare(b.name)
      else if (by === 'size') cmp = (a.size || 0) - (b.size || 0)
      else if (by === 'mtime') cmp = (a.mtime || 0) - (b.mtime || 0)
      return order === 'asc' ? cmp : -cmp
    })
    return items
  })

  const handleSort = (column: 'name' | 'size' | 'mtime') => {
    if (sortBy() === column) {
      setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }
  setSortBy('mtime')
  setSortOrder('desc')

  createEffect(async () => {
    if (!props.visible) {
      return
    }

    const newPath = props.currentDir
    if (!newPath) {
      setCurrentDirItems([])
      return
    }

    setLoading(true)
    try {
      const entries = await listEntries(newPath)
      setCurrentDirItems(entries)
    } catch (err) {
      setError('加载目录失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  })

  const navigateToParent = () => {
    if (!canNavigateUp()) {
      return
    }
    setHistory([...history(), props.currentDir])
    const newPath = pathSegments().slice(0, -1).join('/')
    props.onCurrentDirChange(newPath)
  }

  const navigateBack = () => {
    const historyList = history()
    if (historyList.length > 0) {
      const prev = historyList[historyList.length - 1]
      setHistory(historyList.slice(0, -1))
      props.onCurrentDirChange(prev)
    }
  }

  const navigateToSegment = (index: number) => {
    setHistory([...history(), props.currentDir])
    let newPath = pathSegments()
      .slice(0, index + 1)
      .join('/')
    if (index === 0 && newPath.match(/^[A-Za-z]:$/)) {
      newPath += '/'
    }
    props.onCurrentDirChange(newPath)
  }

  const handleItemClick = (item: DirEntry) => {
    if (!selectable(item)) {
      return
    }

    if (props.multiple) {
      toggleItemSelection(item.name)
      return
    }
    setSelectedItems([item.name])
  }

  const handleItemDoubleClick = (item: DirEntry) => {
    if (!item.isDir) {
      return
    }
    setHistory([...history(), props.currentDir])
    const newPath = pathJoin(props.currentDir, item.name)
    props.onCurrentDirChange(newPath)
    setSelectedItems([])
  }

  const toggleItemSelection = (itemname: string) => {
    const items = selectedItems()
    const index = items.indexOf(itemname)
    if (index > -1) {
      setSelectedItems(items.filter((_, i) => i !== index))
      return
    }
    setSelectedItems(props.multiple ? [...items, itemname] : [itemname])
  }

  const isItemSelected = (itemname: string): boolean => {
    return selectedItems().includes(itemname)
  }

  const handleCancel = () => {
    props.onCancel()
  }

  const handleConfirm = () => {
    const selectedPaths = selectedItems().map((name) => pathJoin(props.currentDir, name))
    props.onConfirm(selectedPaths)
    setSelectedItems([])
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) {
      return ''
    }
    if (timestamp < 2 ** 32) {
      timestamp *= 1000
    }
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setInputMode(null)
    setInputValue('')
  }

  const handleCreateFile = (e: MouseEvent) => {
    e.stopPropagation()
    setContextMenu(null)
    setTimeout(() => setInputMode('file'), 0)
  }

  const handleCreateFolder = (e: MouseEvent) => {
    e.stopPropagation()
    setContextMenu(null)
    setTimeout(() => setInputMode('folder'), 0)
  }

  const handleOpenCurrentFolder = async (e: MouseEvent) => {
    e.stopPropagation()
    const currentPath = props.currentDir.replace(/\//g, '\\')
    await executeCommand([`explorer ${currentPath}`], 'ps')
    closeContextMenu()
  }

  const contextMenuItems = () => [
    { label: '新建文件', onClick: handleCreateFile },
    { label: '新建文件夹', onClick: handleCreateFolder },
    { label: '打开当前文件夹', onClick: handleOpenCurrentFolder },
  ]

  const confirmCreate = async () => {
    const name = inputValue().trim()
    if (!name) {
      return
    }
    const path = pathJoin(props.currentDir, name)
    const success = await createEntry(path, inputMode() === 'folder')
    if (success) {
      const entries = await listEntries(props.currentDir)
      setCurrentDirItems(entries)
    }
    closeContextMenu()
  }

  createEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    onCleanup(() => document.removeEventListener('click', handleClick))
  })

  return (
    <Show when={props.visible}>
      <div class="fixed inset-0 z-10 m-0 flex items-center justify-center">
        <div class="absolute w-full h-full bg-black opacity-50"></div>
        <div class="w-full z-11 max-w-4xl max-h-[80vh] bg-white rounded-lg shadow-xl flex flex-col">
          {}
          <div class="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <h3 class="text-lg font-medium text-gray-700">文件浏览器</h3>
            <NButton
              onClick={handleCancel}
              variant="custom"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <DeleteIcon size={5} />
            </NButton>
          </div>

          {}
          <div class="px-4 py-2 border-b border-gray-200 bg-gray-50 flex justify-between">
            <NButton
              class="mr-3 px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
              onClick={navigateToParent}
              disabled={!canNavigateUp()}
              variant="secondary"
            >
              <SimpleArrowLeftIcon class="w-4 h-4" />
            </NButton>
            <div
              ref={scroll.ref}
              class="flex justify-start space-x-1 items-center overflow-x-auto whitespace-nowrap"
            >
              <For each={pathSegments()}>
                {(segment, index) => (
                  <>
                    <Show when={index() > 0}>
                      <span class="text-gray-400 mx-1 flex items-center">/</span>
                    </Show>
                    <span
                      class="text-sm text-gray-600 cursor-pointer hover:text-green-500 flex items-center"
                      onClick={() => navigateToSegment(index())}
                    >
                      {segment}
                    </span>
                  </>
                )}
              </For>
            </div>
            <NButton
              class="ml-3 px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100"
              onClick={navigateBack}
              disabled={!canNavigateBack()}
              variant="secondary"
            >
              <SimpleArrowRightIcon class="w-4 h-4" />
            </NButton>
          </div>

          {}
          <div class="flex-1 overflow-y-auto nscroll-bar" onContextMenu={handleContextMenu}>
            <Show when={loading()}>
              <div class="flex justify-center items-center h-32 text-gray-500">
                <CircleLoadingIcon size={5} class="animate-spin -ml-1 mr-3 text-gray-400" />
                加载中...
              </div>
            </Show>

            <Show when={error()}>
              <div class="text-center text-red-500 py-8">{error()}</div>
            </Show>

            <Show when={!loading() && !error()}>
              {}
              <div class="flex items-center px-2 py-2 border-b border-gray-100 text-xs font-medium text-gray-600">
                <span class="w-4"></span>
                <span class="w-5 mx-3"></span>
                <div
                  class="flex-1 cursor-pointer hover:text-gray-900"
                  onClick={() => handleSort('name')}
                >
                  名称 {sortBy() === 'name' && (sortOrder() === 'asc' ? '↑' : '↓')}
                </div>
                <div
                  class="w-24 cursor-pointer hover:text-gray-900 text-right"
                  onClick={() => handleSort('size')}
                >
                  大小 {sortBy() === 'size' && (sortOrder() === 'asc' ? '↑' : '↓')}
                </div>
                <div
                  class="w-40 ml-4 cursor-pointer hover:text-gray-900 text-right"
                  onClick={() => handleSort('mtime')}
                >
                  修改时间 {sortBy() === 'mtime' && (sortOrder() === 'asc' ? '↑' : '↓')}
                </div>
              </div>

              {}
              <div class="space-y-1 mt-1">
                <For each={sortedItems()}>
                  {(item) => (
                    <div
                      onClick={() => handleItemClick(item)}
                      onDblClick={() => handleItemDoubleClick(item)}
                      class="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <Show when={selectable(item)}>
                        <NCheckbox
                          checked={isItemSelected(item.name)}
                          onChange={() => toggleItemSelection(item.name)}
                        />
                      </Show>
                      <Show when={!selectable(item)}>
                        <span class="w-4"></span>
                      </Show>
                      <Show when={item.isDir}>
                        {' '}
                        <DirectoryIcon size={5} class="text-yellow-500 mx-3" />
                      </Show>
                      <Show when={!item.isDir}>
                        {' '}
                        <FileIcon size={5} class="text-gray-400 mx-3" />
                      </Show>
                      <span class="flex-1 text-sm text-gray-700">{item.name}</span>
                      <span class="w-24 text-xs text-gray-500 text-right">
                        {item.isDir ? '' : formatFileSize(item.size || 0)}
                      </span>
                      <span class="w-40 ml-4 text-xs text-gray-500 text-right">
                        {formatDate(item.mtime)}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {}
          <Show when={contextMenu()}>
            <div
              class="fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-20"
              style={{ left: `${contextMenu()!.x}px`, top: `${contextMenu()!.y}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <For each={contextMenuItems()}>
                {(menu) => (
                  <div
                    class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    onClick={menu.onClick}
                  >
                    {menu.label}
                  </div>
                )}
              </For>
            </div>
          </Show>

          {}
          <Show when={inputMode()}>
            <div
              class="fixed inset-0 z-20 flex items-center justify-center"
              onClick={closeContextMenu}
            >
              <div class="bg-white p-4 rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div class="text-sm mb-2">新建{inputMode() === 'folder' ? '文件夹' : '文件'}</div>
                <input
                  type="text"
                  class="border border-gray-300 rounded px-2 py-1 w-64"
                  value={inputValue()}
                  onInput={(e) => setInputValue(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmCreate()}
                  autofocus
                />
                <div class="mt-2 flex justify-end space-x-2">
                  <NButton onClick={closeContextMenu} variant="secondary">
                    取消
                  </NButton>
                  <NButton onClick={confirmCreate}>确定</NButton>
                </div>
              </div>
            </div>
          </Show>

          {}
          <div class="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <div class="text-sm text-gray-600">
              已选择 {selectedItems().length} 个{props.type === 'directory' ? '目录' : '文件'}
            </div>
            <div class="space-x-2 flex items-center">
              <NButton onClick={handleCancel} variant="secondary">
                取消
              </NButton>
              <NButton onClick={handleConfirm} disabled={selectedItems().length === 0}>
                确定
              </NButton>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default FileBrowser
