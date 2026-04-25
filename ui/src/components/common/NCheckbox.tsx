import { type Component } from 'solid-js'
import { CheckBoxIcon } from '@/components/common/Icons'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  bgColor?: string
  checkColor?: string
  shape?: 'square' | 'rounded' | 'circle'
}

const Checkbox: Component<CheckboxProps> = (props) => {
  const bgColor = () => props.bgColor || 'bg-green-400'
  const checkColor = () => props.checkColor || 'text-white'
  const shapeClass = () => {
    switch (props.shape) {
      case 'circle':
        return 'rounded-full'
      case 'square':
        return 'rounded-none'
      default:
        return 'rounded-sm'
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        props.onChange(!props.checked)
      }}
      class={`w-4 h-4 flex items-center justify-center border border-gray-300 transition-colors ${shapeClass()} ${
        props.checked ? bgColor() : 'bg-white'
      }`}
    >
      {props.checked && <CheckBoxIcon class={checkColor()} viewBox="0 0 12 12" />}
    </button>
  )
}

export default Checkbox
