import { type Component } from 'solid-js'
import type { ArgumentInputProps } from './types'
import Checkbox from '@/components/common/NCheckbox'

const BooleanInput: Component<ArgumentInputProps> = (props) => {
  const handleChange = (checked: boolean) => {
    props.setArgument({ value: checked })
  }

  return (
    <>
      <label class="flex items-center text-sm text-gray-700 flex-1 gap-2">
        <Checkbox checked={!!props.argument.value} onChange={handleChange} />
        启用
      </label>
    </>
  )
}

export default BooleanInput
