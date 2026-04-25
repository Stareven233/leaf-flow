import { type Component, createMemo, For, Show } from 'solid-js'
import NButton from '../common/NButton'
import type { ArgumentInputProps } from './types'
import type { ArgumentValue } from '@/types/project'

const RadioInput: Component<ArgumentInputProps> = (props) => {
  const isMultiple = () => !!props.argument.multiple
  const normalizeValue = () => {
    const val = props.argument.value
    if (Array.isArray(val)) return val as ArgumentValue[]
    if (val === undefined || val === null) return []
    return [val as ArgumentValue]
  }

  const selectOption = (option?: ArgumentValue) => {
    if (isMultiple() && !!option) {
      const current = normalizeValue()
      const exists = current.includes(option)
      const next = exists ? current.filter((v) => v !== option) : [...current, option]
      props.setArgument({ value: next.length > 0 ? next : undefined })
      return
    }
    if (option === props.argument.value) {
      props.setArgument({ value: undefined })
      return
    }
    props.setArgument({ value: option })
  }

  const selectAll = () => {
    const options = props.argument.options ?? []
    props.setArgument({ value: options.length > 0 ? options : undefined })
  }

  if (isMultiple()) {
    const current = normalizeValue()
    const options = props.argument.options ?? []
    const valid = current.filter((v) => options.includes(v))
    if (valid.length !== current.length) {
      props.setArgument({ value: valid.length > 0 ? valid : undefined })
    }
  } else if (
    props.argument.value &&
    !props.argument.options?.includes(props.argument.value as ArgumentValue)
  ) {
    props.setArgument({ value: undefined })
  }

  const selectedValues = createMemo(normalizeValue)

  const isAllSelected = createMemo(() => {
    if (!isMultiple()) return false
    const options = props.argument.options ?? []
    return options.length > 0 && selectedValues().length === options.length
  })

  const toggleSelections = () => {
    if (!isMultiple()) {
      selectOption(undefined)
      return
    }
    if (isAllSelected()) {
      selectOption(undefined)
      return
    }
    selectAll()
  }

  return (
    <div class="flex items-start gap-3 w-full">
      <div class="flex flex-wrap gap-3 flex-1">
        <For each={props.argument.options}>
          {(option) => (
            <div
              onClick={() => selectOption(option)}
              class="cursor-pointer px-2.5 py-1.5 text-sm border rounded-lg transition-all duration-200 select-none flex items-center justify-center min-w-6 border-none"
              classList={{
                'bg-green-50 text-green-700 ring-1 ring-green-400': isMultiple()
                  ? selectedValues().includes(option)
                  : props.argument.value === option,
                'bg-gray-50 text-gray-600 hover:text-green-500': isMultiple()
                  ? !selectedValues().includes(option)
                  : props.argument.value !== option,
              }}
            >
              {option}
            </div>
          )}
        </For>

        <Show when={!props.argument.options || props.argument.options.length === 0}>
          <div class="text-gray-400 text-sm italic">无可用选项</div>
        </Show>
      </div>

      {}
      <NButton variant="secondary" onClick={toggleSelections}>
        {isMultiple() && !isAllSelected() ? '全选' : '清空'}
      </NButton>
    </div>
  )
}

export default RadioInput
