import { type Component, createSignal } from 'solid-js'
import type { ArgumentInputProps } from './types'

const SliderInput: Component<ArgumentInputProps> = (props) => {
  const [editing, setEditing] = createSignal(false)

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    props.setArgument({ value: Number(target.value) })
  }

  const handleNumberInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    const val = Number(target.value)
    if (!isNaN(val)) {
      props.setArgument({ value: Math.max(min(), Math.min(max(), val)) })
    }
  }

  const min = () => props.argument.min ?? 0
  const max = () => props.argument.max ?? 100
  const step = () => props.argument.step ?? 1
  const value = () => (props.argument.value as number) ?? min()

  return (
    <>
      <div class="flex items-center gap-3">
        <input
          type="range"
          value={value()}
          onInput={handleInput}
          min={min()}
          max={max()}
          step={step()}
          class="flex-1 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-green-400"
        />
        {editing() ? (
          <input
            type="number"
            value={value()}
            onInput={handleNumberInput}
            onBlur={() => setEditing(false)}
            min={min()}
            max={max()}
            step={step()}
            class="text-gray-500 min-w-12 text-right font-mono bg-transparent outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            autofocus
          />
        ) : (
          <span
            class="text-gray-700 min-w-12 text-right font-mono cursor-text"
            onClick={() => setEditing(true)}
          >
            {value()}
          </span>
        )}
      </div>
    </>
  )
}

export default SliderInput
