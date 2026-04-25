import { type Component, createSignal, createMemo, For, Show } from 'solid-js'
import { inputClass } from './innerStyles'
import type { ArgumentInputProps } from './types'
import { SimpleArrowDownIcon } from '@/components/common/Icons'
import type { ArgumentValue } from '@/types/project'

const SelectInput: Component<ArgumentInputProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal('')
  if (
    props.argument.value &&
    !props.argument.options?.includes(props.argument.value as ArgumentValue)
  ) {
    props.setArgument({ value: undefined })
  }

  const filteredOptions = createMemo(() => {
    if (!searchQuery()) {
      return props.argument.options
    }
    const query = searchQuery().toLowerCase()
    return (
      props.argument.options?.filter((opt) => opt.toString().toLowerCase().includes(query)) || []
    )
  })

  const toggleDropdown = () => {
    setIsOpen(!isOpen())
    if (!isOpen()) {
      setSearchQuery('')
    }
  }

  const selectOption = (option?: ArgumentValue) => {
    props.setArgument({ value: option })
    setIsOpen(false)
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (!target.closest('.nscroll-bar')) {
      setIsOpen(false)
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }

  return (
    <div class="relative nscroll-bar">
      {}
      <div
        onClick={toggleDropdown}
        class={`flex items-center justify-between cursor-pointer ${inputClass}`}
      >
        <span
          class="truncate flex-1"
          classList={{
            'text-gray-500': !props.argument.value,
          }}
        >
          {!props.argument.value ? '请选择' : props.argument.value}
        </span>
        <SimpleArrowDownIcon
          class="text-gray-500 transition-transform"
          classList={{ 'rotate-180': isOpen() }}
        />
      </div>

      {}
      <Show when={isOpen()}>
        <ul class="nscroll-bar pr-2 absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {}
          <Show when={props.argument.options && props.argument.options.length > 5}>
            <div class="sticky top-0 bg-white px-2 py-1">
              <input
                name="search-input"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                type="text"
                placeholder="搜索选项..."
                class="w-full px-2 py-1.5 text-sm border-none rounded-md focus:outline-none"
              />
              <hr class="mb-1 border-gray-200" />
            </div>
          </Show>

          {}
          <Show when={!props.argument.required}>
            <li
              onClick={() => selectOption(undefined)}
              class="px-3 py-2.5 text-sm text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors truncate border-b border-gray-100 italic"
              classList={{
                'bg-gray-50 text-gray-800': props.argument.value === undefined,
              }}
            >
              清空
            </li>
          </Show>

          <For each={filteredOptions()}>
            {(option) => (
              <li
                onClick={() => selectOption(option)}
                class="px-3 py-2.5 text-sm text-gray-700 cursor-pointer hover:bg-green-50 transition-colors truncate"
                classList={{
                  'bg-green-50 text-green-700': props.argument.value === option,
                }}
              >
                {option}
              </li>
            )}
          </For>

          {}
          <Show when={filteredOptions()?.length === 0}>
            <p class="px-3 py-2.5 text-sm text-gray-400 text-center">未找到匹配项</p>
          </Show>
        </ul>
      </Show>
    </div>
  )
}

export default SelectInput
