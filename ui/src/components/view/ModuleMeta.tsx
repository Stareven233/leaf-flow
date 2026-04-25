import { Component, createSignal, Show, For, Index } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type {
  ArgumentDType,
  ArgumentMethod,
  Argument,
  ArgumentValue,
  ModuleMeta,
} from '@/types/project'
import { getComponent } from '@/components/argumentInput'
import NButton from '@/components/common/NButton'
import { DustbinIcon, PlusIcon } from '@/components/common/Icons'

export const typeOptions: { label: string; value: ArgumentDType }[] = [
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'file', value: 'file' },
  { label: 'directory', value: 'directory' },
]
export const methodOptions: { label: string; value: ArgumentMethod }[] = [
  { label: 'input', value: 'input' },
  { label: 'slide', value: 'slide' },
  { label: 'radio', value: 'radio' },
  { label: 'select', value: 'select' },
  { label: 'switch', value: 'switch' },
]

export const newInputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-400 transition-all'

interface ModuleMetaItemProps {
  argument: Argument
  onUpdate: (updates: Partial<Argument>) => void
  onDelete: () => void
}

interface MetaSectionProps {
  title: string
  emptyText: string
  addTitle: string
  meta?: ModuleMeta
  onUpdate: (key: string, value: Argument) => void
  onDelete: (key: string) => void
  onAdd: (
    key: string,
    dtype: ArgumentDType,
    method: ArgumentMethod | undefined,
    value: ArgumentValue,
  ) => void
  headerExtra?: string
  bordered?: boolean
}

const ModuleMetaItem: Component<ModuleMetaItemProps> = (props) => {
  const InputComponent = () => getComponent(props.argument.dtype, props.argument.method)

  const handleUpdate = (updates: Partial<Argument>) => {
    let finalUpdates = { ...updates }
    if (Array.isArray(finalUpdates.value)) {
      finalUpdates.value = finalUpdates.value[0]
    }
    props.onUpdate(finalUpdates)
  }

  return (
    <div class="flex items-center gap-4 p-2 rounded-md hover:bg-green-50 focus:ring-1 transition-colors">
      <div class="w-1/3 min-w-37.5">
        <span class="text-sm font-medium text-gray-700 block truncate" title={props.argument.key}>
          {props.argument.name || props.argument.key}
        </span>
        <span class="text-xs text-gray-400">{props.argument.dtype || 'string'}</span>
        {props.argument.method && (
          <span class="text-xs text-gray-400 ml-1">({props.argument.method})</span>
        )}
      </div>

      <div class="flex-1">
        <Dynamic
          component={InputComponent()}
          argument={props.argument}
          setArgument={handleUpdate}
        />
      </div>

      <NButton onClick={props.onDelete} variant="error" title="删除">
        <DustbinIcon />
      </NButton>
    </div>
  )
}

export const MetaSection: Component<MetaSectionProps> = (props) => {
  const [draftKey, setDraftKey] = createSignal('')
  const [draftValue, setDraftValue] = createSignal('')
  const [draftType, setDraftType] = createSignal<ArgumentDType>('string')
  const [draftMethod, setDraftMethod] = createSignal<ArgumentMethod | undefined>(undefined)

  const addMeta = () => {
    const key = draftKey().trim()
    if (!key || key in (props.meta || {})) {
      return
    }

    const type = draftType()
    const value = draftValue()
    let parsedValue: ArgumentValue = value
    if (type === 'number') {
      parsedValue = value ? Number(value) : 0
    } else if (type === 'boolean') {
      const v = value.trim()
      parsedValue = v !== 'false' && v !== '0'
    }

    props.onAdd(key, type, draftMethod(), parsedValue)
    setDraftKey('')
    setDraftValue('')
    setDraftType('string')
    setDraftMethod(undefined)
  }

  return (
    <div classList={{ 'border-t border-gray-200 pt-6': !!props.bordered }}>
      <div class="flex items-center justify-between border-b border-gray-100 pb-4">
        <h3 class="text-lg font-semibold text-gray-800">{props.title}</h3>
        <Show when={props.headerExtra}>
          <span class="text-sm text-gray-500">{props.headerExtra}</span>
        </Show>
      </div>

      {}
      <div class="space-y-3 overflow-y-auto pr-2 pt-4">
        <Show
          when={props.meta && Object.keys(props.meta).length > 0}
          fallback={<div class="text-gray-400 italic text-center py-4">{props.emptyText}</div>}
        >
          <Index each={Object.values(props.meta ?? {})}>
            {(arg) => (
              <ModuleMetaItem
                argument={arg()}
                onUpdate={(updates) => {
                  const updated = { ...arg(), ...updates }
                  props.onUpdate(updated.key, updated)
                }}
                onDelete={() => props.onDelete(arg().key)}
              />
            )}
          </Index>
        </Show>
      </div>

      {}
      <div class="border-t border-gray-100 pt-4 mt-4 keep-all">
        <h4 class="text-sm font-medium text-gray-700 mb-3">{props.addTitle}</h4>
        <div class="flex gap-2 items-end list-none">
          <div class="w-48">
            <label class="block text-xs text-gray-500 mb-1">键</label>
            <input
              value={draftKey()}
              onInput={(e) => setDraftKey(e.currentTarget.value)}
              type="text"
              placeholder="输入键名"
              class={newInputClass}
              onKeyPress={(e) => e.key === 'Enter' && addMeta()}
            />
          </div>
          <div class="flex-1">
            <label class="block text-xs text-gray-500 mb-1">值</label>
            <input
              value={draftValue()}
              onInput={(e) => setDraftValue(e.currentTarget.value)}
              type="text"
              placeholder="输入值"
              class={newInputClass}
              onKeyPress={(e) => e.key === 'Enter' && addMeta()}
            />
          </div>
          <div class="w-28">
            <label class="block text-xs text-gray-500 mb-1">类型</label>
            <select
              value={draftType()}
              onChange={(e) => setDraftType(e.currentTarget.value as ArgumentDType)}
              class={`${newInputClass} bg-white`}
            >
              <For each={typeOptions}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>
          <div class="w-28">
            <label class="block text-xs text-gray-500 mb-1">方式</label>
            <select
              value={draftMethod() || ''}
              onChange={(e) =>
                setDraftMethod((e.currentTarget.value as ArgumentMethod) || undefined)
              }
              class={`${newInputClass} bg-white xl:z-4000`}
            >
              <option value="">默认</option>
              <For each={methodOptions}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>
          <NButton onClick={addMeta} disabled={!draftKey().trim()}>
            <PlusIcon class="mr-1" /> 添加
          </NButton>
        </div>
      </div>
    </div>
  )
}
