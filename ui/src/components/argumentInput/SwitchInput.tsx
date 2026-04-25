import { type Component } from 'solid-js'
import type { ArgumentInputProps } from './types'

const SwitchInput: Component<ArgumentInputProps> = (props) => {
  const handleToggle = () => {
    props.setArgument({ value: !props.argument.value })
  }

  return (
    <>
      <label class="flex items-center text-sm text-gray-700 flex-1 gap-2 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={!!props.argument.value}
          onClick={handleToggle}
          class={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
            props.argument.value ? 'bg-green-400' : 'bg-gray-300'
          }`}
        >
          <span
            class={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
              props.argument.value ? 'translate-x-4.5' : 'translate-x-0.75'
            }`}
          />
        </button>
        {props.argument.value ? '启用' : '禁用'}
      </label>
    </>
  )
}

export default SwitchInput
