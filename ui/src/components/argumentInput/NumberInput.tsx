import { type Component, createSignal, createEffect } from 'solid-js'
import { inputClass } from './innerStyles'
import type { ArgumentInputProps } from './types'
import NButton from '../common/NButton'
import { FilledPlusIcon, FilledMinusIcon, FilledDeleteIcon } from '@/components/common/Icons'

const NumberInput: Component<ArgumentInputProps> = (props) => {
  const [localValue, setLocalValue] = createSignal<number | undefined>(
    props.argument.value == null ? undefined : Number(props.argument.value),
  )

  createEffect(() => {
    const externalValue = props.argument.value == null ? undefined : Number(props.argument.value)
    setLocalValue(externalValue)
  })

  const numberValue = () => {
    return localValue() == null ? 0 : localValue()!
  }

  const normedValue = (v: number) =>
    Math.min(props.argument.max ?? Infinity, Math.max(props.argument.min ?? -Infinity, v))

  const commitValue = (value: number | undefined) => {
    props.setArgument({ value })
  }

  const handleChange = (sign: number) => {
    const step = props.argument.step ?? 1
    const newValue = numberValue() + step * sign
    const normed = normedValue(newValue)
    setLocalValue(normed)
    commitValue(normed)
  }

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    const newValue = target.value === '' ? undefined : Number(target.value)
    setLocalValue(newValue)
  }

  const handleBlur = () => {
    if (localValue() === undefined) {
      commitValue(undefined)
      return
    }
    const normed = normedValue(numberValue())
    setLocalValue(normed)
    commitValue(normed)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement
      target.blur()
    }
  }

  const handleClear = () => {
    setLocalValue(undefined)
    commitValue(undefined)
  }

  return (
    <>
      <div class="flex items-center gap-2">
        <input
          type="number"
          name="number-input"
          value={localValue() === undefined ? '' : localValue()}
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          min={props.argument.min}
          max={props.argument.max}
          placeholder="输入数字"
          class={inputClass}
        />

        {}
        <NButton
          variant="custom"
          onClick={() => handleChange(-1)}
          name="decrement-btn"
          class="p-2 text-gray-400 hover:text-green-500 transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!!(props.argument.min && numberValue() <= props.argument.min)}
          title="减少"
        >
          <FilledMinusIcon size={5} />
        </NButton>

        {}
        <NButton
          variant="custom"
          onClick={() => handleChange(1)}
          name="increment-btn"
          class="p-2 text-gray-400 hover:text-green-500 transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={!!(props.argument.max && numberValue() >= props.argument.max)}
          title="增加"
        >
          <FilledPlusIcon size={5} />
        </NButton>

        {}
        {localValue() !== undefined && (
          <NButton
            variant="custom"
            onClick={handleClear}
            name="clear-btn"
            class="p-2 text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
            title="清除"
          >
            <FilledDeleteIcon size={5} />
          </NButton>
        )}
      </div>
    </>
  )
}

export default NumberInput
