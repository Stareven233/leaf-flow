import { type Component } from 'solid-js'
import { inputClass } from './innerStyles'
import type { ArgumentInputProps } from './types'
import NButton from '../common/NButton'
import { FilledPlusIcon, FilledMinusIcon, FilledDeleteIcon } from '@/components/common/Icons'

const NumberInput: Component<ArgumentInputProps> = (props) => {
  const numberValue = () => {
    return props.argument.value == null ? 0 : Number(props.argument.value)
  }

  const normedValue = (v: number) =>
    Math.min(props.argument.max ?? Infinity, Math.max(props.argument.min ?? -Infinity, v))

  const handleChange = (sign: number) => {
    const step = props.argument.step ?? 1
    const newValue = numberValue() + step * sign
    props.setArgument({ value: normedValue(newValue) })
  }

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    props.setArgument({ value: Number(target.value) })
  }

  const handleBlur = () => props.setArgument({ value: normedValue(numberValue()) })

  const handleClear = () => {
    props.setArgument({ value: 0 })
  }

  return (
    <>
      <div class="flex items-center gap-2">
        <input
          type="number"
          name="number-input"
          value={numberValue()}
          onInput={handleInput}
          onBlur={handleBlur}
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
        {!props.argument.required && props.argument.value && (
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
