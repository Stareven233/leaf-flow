import { type Component, createSignal, createMemo, onMount, For, Show } from 'solid-js'
import FileBrowser from './FileBrowser'
import * as path from '@/utils/path'
import type { ArgumentInputProps } from './types'
import type { Argument, ArgumentMap, ArgumentValue } from '@/types/project'
import NButton from '@/components/common/NButton'
import { loadQueueArguments, isEmpty } from '@/utils/execution'
import { inputClass } from './innerStyles'
import NPopover from '@/components/common/NPopover'
import { useDecodedParams } from '@/utils/hooks/useDecodedParams'
import {
  DeleteIcon,
  FileIcon,
  QuestionIcon,
  UploadIcon,
  CircleLoadingIcon,
} from '@/components/common/Icons'
import { useConfigStore } from '@/stores/config'
import { uploadTempFiles } from '@/apis/file'

const PathInput: Component<ArgumentInputProps> = (props) => {
  const [tempPath, setTempPath] = createSignal<string>('')
  const [showSelectOptions, setShowSelectOptions] = createSignal<boolean>(false)
  const [showFileBrowser, setShowFileBrowser] = createSignal<boolean>(false)
  const [historyFiles, setHistoryFiles] = createSignal<string[]>([])
  const [isUploading, setIsUploading] = createSignal<boolean>(false)
  const [uploadPercent, setUploadPercent] = createSignal<number>(0)
  const [isDragging, setIsDragging] = createSignal<boolean>(false)
  const [uploadError, setUploadError] = createSignal<string | null>(null)
  let fileInputBox: HTMLInputElement | undefined
  let fileUploadInputRef: HTMLInputElement | undefined

  const params = useDecodedParams()
  const configStore = useConfigStore()

  const methods = createMemo(() => {
    const method = props.argument.method || ''
    return method
      .split(/[|,]/)
      .map((m) => {
        const item = m.trim().toLowerCase()
        return item === 'uplaod' ? 'upload' : item
      })
      .filter(Boolean)
  })

  const isMmapEnabled = createMemo(() => {
    const marker = configStore.data()?.mmapMarker
    if (!marker) {
      return false
    }

    const v = props.argument.value
    if (Array.isArray(v)) {
      return v.includes(marker)
    }
    return v === marker
  })

  const supportsMmap = () => props.argument.dtype === 'file' && methods().includes('mmap')
  const supportsSelect = () =>
    (methods().length === 0 || methods().includes('select')) && !isMmapEnabled()
  const supportsUpload = () =>
    props.argument.dtype === 'file' && methods().includes('upload') && !isMmapEnabled()
  const shouldResolvePath = () => methods().includes('resolve')

  const selectedPaths = createMemo(() => {
    const v = props.argument.value
    const marker = configStore.data()?.mmapMarker
    if (Array.isArray(v)) {
      return v.filter((item) => typeof item === 'string' && item !== marker) as string[]
    }
    return v && typeof v === 'string' && v !== marker ? [v] : []
  })

  const resolvePathFromRoot = (
    rootDir: string,
    target: ArgumentValue,
  ): ArgumentValue | undefined => {
    const marker = configStore.data()?.mmapMarker
    if (!target || typeof target !== 'string' || target === marker) {
      return target
    }
    return path.isAbsolute(target) ? path.normalize(target) : path.join(rootDir, target)
  }

  const setPathArgument = async (updates: Partial<Argument>) => {
    if (shouldResolvePath()) {
      const rootDir = await configStore.rootDir()
      const projectDir = path.join(rootDir, configStore.data()!.uiDir, '..')
      if ('dir' in updates) {
        const normalizedDir = path.normalize(updates.dir || '.')
        updates.dir = resolvePathFromRoot(projectDir, normalizedDir) as string
      }
      if ('value' in updates && !!updates.value) {
        const value = updates.value
        if (typeof value === 'string') {
          updates.value = resolvePathFromRoot(projectDir, value)
        } else if (Array.isArray(value)) {
          updates.value = value
            .map((item) => resolvePathFromRoot(projectDir, item))
            .filter((item) => typeof item === 'string')
        }
      }
    }
    props.setArgument(updates)
  }

  const appendPaths = async (pathsToAdd: string[], toUpdate: boolean = true) => {
    const validPaths = pathsToAdd.map((item) => item.trim()).filter(Boolean)
    if (validPaths.length === 0) {
      return
    }

    let selected: string | string[]
    if (!props.argument.multiple) {
      selected = validPaths[0]
    } else {
      if (Array.isArray(props.argument.value)) {
        selected = [...props.argument.value.filter((item) => typeof item === 'string')]
      } else {
        selected = props.argument.value ? [props.argument.value.toString()] : []
      }

      validPaths.forEach((item) => {
        if (!selected.includes(item)) {
          ;(selected as string[]).push(item)
        }
      })
    }

    if (toUpdate) {
      const lastPath = Array.isArray(selected) ? selected[selected.length - 1] : selected
      const [dir] = path.split(lastPath)
      await setPathArgument({ value: selected, dir })
    }

    return selected
  }

  onMount(async () => {
    const key = props.argument.key
    const files = new Set<string>()
    const isFlow = !!params.flow
    const history = isFlow
      ? loadQueueArguments('flow', params.flow, params.branch)
      : loadQueueArguments('project', params.project, params.module)

    const extractFromMap = (map: ArgumentMap) => {
      const val = map[key]
      if (isEmpty(val)) {
        return
      }
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (v) files.add(v as string)
        })
      } else {
        files.add(String(val))
      }
    }

    history.forEach(({ item }) => {
      if (isFlow) {
        Object.values(item.map as Record<string, ArgumentMap>).forEach(extractFromMap)
      } else {
        extractFromMap(item.map as ArgumentMap)
      }
    })
    setHistoryFiles(Array.from(files))

    let initialDir = props.argument.dir
    const currentValue = props.argument.value
    const marker = configStore.data()?.mmapMarker

    if (currentValue) {
      let lastPath: string | undefined
      if (Array.isArray(currentValue)) {
        const validPaths = currentValue.filter(
          (item) => typeof item === 'string' && item !== marker,
        ) as string[]
        lastPath = validPaths[validPaths.length - 1]
      } else if (typeof currentValue === 'string' && currentValue !== marker) {
        lastPath = currentValue
      }

      if (lastPath) {
        const [dir] = path.split(lastPath)
        initialDir = dir
      }
    }

    if (shouldResolvePath()) {
      await setPathArgument({ dir: initialDir, value: props.argument.value })
    } else if (initialDir !== props.argument.dir) {
      props.setArgument({ dir: initialDir })
    }

    if (props.argument.method === 'mmap' && props.argument.value === undefined) {
      enableMmap(true)
    }
  })

  const handleFileSelect = (filePath: string) => {
    if (!filePath) {
      return
    }
    appendPaths([filePath])
    if (!props.argument.multiple) {
      setShowSelectOptions(false)
      fileInputBox?.blur()
    }
  }

  const handlePathInput = async () => {
    const p = tempPath().trim()
    if (!p) {
      return
    }
    const paths = await appendPaths([p], false)
    if (paths === undefined) {
      return
    }
    setTempPath('')
    const [dir] = path.split(p)
    setPathArgument({ value: paths, dir })
  }

  const handleFileBrowserConfirm = (items: string[]) => {
    setShowFileBrowser(false)
    if (items.length === 0) {
      return
    }
    appendPaths(items)
  }

  const removePath = (index: number) => {
    if (!Array.isArray(props.argument.value)) {
      setPathArgument({ value: '' })
      return
    }
    const arr = [...(props.argument.value as string[])]
    arr.splice(index, 1)

    if (arr.length > 0) {
      const marker = configStore.data()?.mmapMarker
      const validPaths = arr.filter(
        (item) => typeof item === 'string' && item !== marker,
      ) as string[]
      if (validPaths.length > 0) {
        const lastPath = validPaths[validPaths.length - 1]
        const [dir] = path.split(lastPath)
        setPathArgument({ value: arr, dir })
        return
      }
    }

    setPathArgument({ value: arr })
  }

  const enableMmap = (enable: boolean) => {
    const marker = configStore.data()?.mmapMarker
    if (!marker) {
      return
    }
    const v = props.argument.value

    if (!enable && isMmapEnabled()) {
      if (!props.argument.multiple && v === marker) {
        setPathArgument({ value: '' })
      } else {
        const arr = Array.isArray(v) ? v.filter((item) => item !== marker) : []
        setPathArgument({ value: arr })
      }
    } else if (enable && !isMmapEnabled()) {
      if (!props.argument.multiple) {
        setPathArgument({ value: marker })
      } else {
        const arr = Array.isArray(v) ? [...v] : []
        if (!arr.includes(marker)) {
          arr.push(marker)
        }
        setPathArgument({ value: arr })
      }
    }
  }

  const handleDirInput = (e: FocusEvent) => {
    const target = e.target as HTMLInputElement
    setPathArgument({ dir: target.value })
  }

  const handleUploadFiles = async (files: File[]) => {
    if (files.length === 0) return
    const filesToUpload = props.argument.multiple ? files : [files[0]]
    setIsUploading(true)
    setUploadPercent(0)
    setUploadError(null)
    try {
      const paths = await uploadTempFiles(filesToUpload, (percent) => {
        setUploadPercent(percent)
      })
      if (paths && paths.length > 0) {
        await appendPaths(paths)
      }
    } catch (err: any) {
      console.error('File upload failed:', err)
      setUploadError(err?.message || '上传失败')
    } finally {
      setIsUploading(false)
      setUploadPercent(0)
    }
  }

  let dragCounter = 0

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter++
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setIsDragging(true)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    if (!isDragging()) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter--
    if (
      dragCounter <= 0 ||
      (e.currentTarget && !(e.currentTarget as any).contains(e.relatedTarget as Node))
    ) {
      dragCounter = 0
      setIsDragging(false)
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter = 0
    setIsDragging(false)
    const dt = e.dataTransfer
    if (dt && dt.files && dt.files.length > 0) {
      const files = Array.from(dt.files)
      await handleUploadFiles(files)
    }
  }

  const handleFileInputChange = async (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      const files = Array.from(target.files)
      await handleUploadFiles(files)
    }
    target.value = ''
  }

  return (
    <section>
      {}
      <Show when={supportsUpload()}>
        <input
          ref={fileUploadInputRef}
          type="file"
          multiple={props.argument.multiple}
          class="hidden"
          onChange={handleFileInputChange}
        />
      </Show>

      {}
      <Show when={supportsMmap()}>
        <NPopover content={'启用表示采用临时文件进行数据读写（MMAP）\n常用于构建流中间步骤'}>
          <label class="flex items-center gap-2 my-2 text-sm text-gray-700 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={isMmapEnabled()}
              onClick={() => enableMmap(!isMmapEnabled())}
              class={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${isMmapEnabled() ? 'bg-green-400' : 'bg-gray-300'}`}
            >
              <span
                class={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${isMmapEnabled() ? 'translate-x-4.5' : 'translate-x-0.75'}`}
              />
            </button>
            临时文件
          </label>
        </NPopover>
      </Show>

      {}
      <Show when={!isMmapEnabled()}>
        {}
        <Show when={supportsSelect()}>
          <label class="w-full flex flex-row items-center gap-2 pb-1.5 text-sm font-medium text-gray-700">
            当前目录:
            <input
              type="text"
              name="currentdir-input"
              value={props.argument.dir || ''}
              onBlur={handleDirInput}
              class={`${inputClass.replace('w-full px-3 py-2', '')} flex-1 text-sm text-gray-700 px-1`}
            />
          </label>

          {}
          <div
            class="flex gap-3"
            onDragEnter={supportsUpload() ? handleDragEnter : undefined}
            onDragOver={supportsUpload() ? handleDragOver : undefined}
            onDragLeave={supportsUpload() ? handleDragLeave : undefined}
            onDrop={supportsUpload() ? handleDrop : undefined}
          >
            <div class="relative flex-1">
              <input
                ref={fileInputBox}
                name="path-input"
                value={tempPath()}
                onInput={(e) => setTempPath(e.currentTarget.value)}
                type="text"
                placeholder={
                  supportsUpload()
                    ? isDragging()
                      ? '松开鼠标立即上传至临时目录'
                      : '拖拽（客户端）文件进行上传 或 输入（服务端）目标路径'
                    : `输入${props.argument.dtype === 'file' ? '文件' : '目录'}路径`
                }
                class={`${inputClass} ${isDragging() ? 'ring-2 ring-green-400 bg-green-50/60 placeholder-green-600' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePathInput()
                  }
                }}
                onFocus={() => setShowSelectOptions(true)}
                onBlur={() => setShowSelectOptions(false)}
                onDragEnter={supportsUpload() ? handleDragEnter : undefined}
                onDragOver={supportsUpload() ? handleDragOver : undefined}
                onDragLeave={supportsUpload() ? handleDragLeave : undefined}
                onDrop={supportsUpload() ? handleDrop : undefined}
              />

              <Show when={!isDragging() && showSelectOptions() && historyFiles().length > 0}>
                <div
                  class="nscroll-bar pr-2 max-h-40 overflow-y-auto absolute top-10 p-1 space-y-1 z-10 w-full bg-white border border-gray-300 rounded-md shadow-md"
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ 'padding-right': '0px' }}
                >
                  <For each={historyFiles()}>
                    {(file) => (
                      <span
                        class="px-3 py-2 text-sm text-gray-700 hover:bg-green-50 cursor-pointer rounded-md transition-colors block"
                        onClick={() => handleFileSelect(file)}
                      >
                        {file}
                      </span>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {}
            <Show when={supportsUpload()}>
              <NButton
                variant="custom"
                onClick={() => fileUploadInputRef?.click()}
                disabled={isUploading()}
                class="px-3 py-2 text-white rounded-md text-sm bg-green-300 hover:bg-green-400"
                title="从客户端上传文件至服务端临时目录"
              >
                <Show when={isUploading()} fallback={<UploadIcon />}>
                  <CircleLoadingIcon class="animate-spin" />
                </Show>
              </NButton>
            </Show>

            {}
            <NButton
              variant="custom"
              onClick={() => setShowFileBrowser(true)}
              class="px-3 py-2 text-white rounded-md text-sm bg-green-300 hover:bg-green-400"
              title="打开文件浏览器"
            >
              <QuestionIcon />
            </NButton>
          </div>
        </Show>

        {}
        <Show when={!supportsSelect() && supportsUpload()}>
          <div
            class={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${
              isDragging()
                ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                : 'border-gray-300 hover:border-green-400 bg-gray-50/60 hover:bg-green-50/20'
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileUploadInputRef?.click()}
          >
            <Show
              when={isUploading()}
              fallback={
                <>
                  <UploadIcon class="h-8 w-8 text-green-500 mb-2" />
                  <p class="text-sm text-gray-700 font-medium">
                    {isDragging() ? '松开鼠标立即上传' : '点击或拖拽文件至此处上传'}
                  </p>
                  <p class="text-xs text-gray-400 mt-1">
                    {props.argument.multiple ? '支持多文件' : '单文件'}，自动存入服务端临时目录
                  </p>
                </>
              }
            >
              <CircleLoadingIcon class="h-8 w-8 text-green-500 animate-spin mb-2" />
              <p class="text-sm text-green-600 font-medium">正在上传中... {uploadPercent()}%</p>
            </Show>
          </div>
        </Show>

        {}
        <Show when={isUploading() && supportsSelect()}>
          <div class="flex items-center gap-2 mt-1.5 text-xs text-green-600">
            <CircleLoadingIcon class="h-3.5 w-3.5 animate-spin" />
            <span>正在上传至服务端临时目录... {uploadPercent()}%</span>
          </div>
        </Show>

        {}
        <Show when={uploadError()}>
          <p class="mt-1 text-xs text-red-500">{uploadError()}</p>
        </Show>

        {}
        <Show when={selectedPaths().length > 0}>
          <div class="bg-gray-50 rounded-md p-3 mt-2">
            <p class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              已选择{props.argument.dtype === 'file' ? '文件' : '目录'}: ({selectedPaths().length})
            </p>
            <ul class="nscroll-bar pr-2 space-y-1 max-h-32 overflow-y-auto">
              <For each={selectedPaths()}>
                {(filePath, index) => (
                  <li class="flex items-center px-2 py-2 bg-white border border-gray-200 rounded-md text-sm shadow-sm shrink-0 gap-2 overflow-hidden">
                    <p class="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                      <FileIcon class="text-gray-400 shrink-0" />
                      <span class="whitespace-nowrap overflow-x-auto scrollbar-hide">
                        {filePath}
                      </span>
                    </p>
                    <NButton variant="error" onClick={() => removePath(index())}>
                      <DeleteIcon />
                    </NButton>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>

        {}
        <Show when={supportsSelect()}>
          <FileBrowser
            currentDir={props.argument.dir || '.'}
            onCurrentDirChange={(dir) => setPathArgument({ dir })}
            visible={showFileBrowser()}
            type={props.argument.dtype === 'directory' ? 'directory' : 'file'}
            multiple={props.argument.multiple}
            onCancel={() => setShowFileBrowser(false)}
            onConfirm={handleFileBrowserConfirm}
          />
        </Show>
      </Show>
    </section>
  )
}

export default PathInput
