import { type Component, Index, createMemo, createSignal, Show } from 'solid-js'
import type { ArgumentInputProps } from './types'
import type { Argument, ArgumentValue } from '@/types/project'
import NButton from '../common/NButton'
import { FilledPlusIcon, FilledDeleteIcon } from '@/components/common/Icons'
import { useScroll } from '@/utils/hooks/useScroll'

interface ArrayWrapperProps {
  argument: Argument
  setArgument: (updates: Partial<Argument>) => void
  innerComponent: Component<ArgumentInputProps>
}

const ArrayWrapper: Component<ArrayWrapperProps> = (props) => {
  const scroll = useScroll({ direction: 'vertical' })

  const [expanded, setExpanded] = createSignal(false)
  const items = createMemo(() => {
    const val = props.argument.value
    if (Array.isArray(val)) return val
    return val != null ? [val] : []
  })

  const updateItem = (index: number, value: ArgumentValue) => {
    const newItems = [...items()]
    newItems[index] = value
    props.setArgument({ value: newItems })
  }

  const addItem = () => {
    const defaultValue =
      props.argument.dtype === 'number' ? 0 : props.argument.dtype === 'boolean' ? false : ''
    props.setArgument({ value: [...items(), defaultValue] })
  }

  const removeItem = (index: number) => {
    const newItems = items().filter((_, i) => i !== index)
    props.setArgument({ value: newItems.length > 0 ? newItems : undefined })
  }

  return (
    <section class="space-y-2">
      <div
        ref={scroll.ref}
        class={items().length > 0 ? 'py-2' : ''}
        style={{ 'max-height': expanded() ? 'none' : '12rem' }}
      >
        <Index each={items()}>
          {(item, index) => (
            <div class="flex items-center gap-2 px-2">
              <div class="flex-1">
                <props.innerComponent
                  argument={{ ...props.argument, value: item() }}
                  setArgument={(updates) => {
                    if ('value' in updates && updates.value !== undefined) {
                      updateItem(index, updates.value as ArgumentValue)
                    }
                  }}
                />
              </div>
              <NButton
                variant="custom"
                onClick={() => removeItem(index)}
                class="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="删除"
              >
                <FilledDeleteIcon size={5} />
              </NButton>
            </div>
          )}
        </Index>
      </div>
      <div class="flex items-center gap-2">
        <NButton
          variant="custom"
          onClick={addItem}
          class="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
        >
          <FilledPlusIcon size={4} />
          <span>添加项</span>
        </NButton>
        <Show when={items().length > 0}>
          <NButton
            variant="custom"
            onClick={() => setExpanded(!expanded())}
            class="px-3 py-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
          >
            {expanded() ? '收起' : '展开'}
          </NButton>
        </Show>
      </div>
    </section>
  )
}

export default ArrayWrapper
