import { type Component } from 'solid-js'
import { inputClass } from './innerStyles'
import type { ArgumentInputProps } from './types'

interface StringInputProps extends ArgumentInputProps {
  placeholder?: string
}

const StringInput: Component<StringInputProps> = (props) => {
  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    props.setArgument({ value: target.value })
  }

  return (
    <>
      <input
        type="text"
        name="string-input"
        value={(props.argument.value as string) || ''}
        onInput={handleInput}
        placeholder={props.placeholder ? `默认: ${props.placeholder}` : '输入参数值'}
        class={inputClass}
      />
    </>
  )
}

export default StringInput
