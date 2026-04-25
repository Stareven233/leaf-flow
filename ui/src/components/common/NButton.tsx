import { Component, JSX, splitProps } from 'solid-js'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'error' | 'warn' | 'custom'
  children?: JSX.Element
}

const NButton: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ['variant', 'class', 'disabled', 'children'])

  const colorClass = () => {
    if (local.variant === 'custom') {
      return ''
    }
    switch (local.variant) {
      case 'secondary':
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      case 'warn':
        return 'bg-orange-100 text-orange-500 hover:bg-orange-200'
      case 'error':
        return 'text-red-200 hover:text-red-500 hover:bg-red-50'
      default:
        return 'bg-green-400 text-white hover:bg-green-500'
    }
  }

  const shapeClass = () => {
    if (local.variant === 'custom') {
      return ''
    }
    switch (local.variant) {
      case 'error':
        return 'p-1 rounded-full shrink-0 ml-auto'
      default:
        return 'px-4 py-2 rounded-md text-sm'
    }
  }

  return (
    <button
      class={twMerge(
        clsx(
          'flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer transition-colors',
          shapeClass(),
          colorClass(),
          local.class,
        ),
      )}
      disabled={local.disabled}
      {...others}
    >
      {local.children}
    </button>
  )
}

export default NButton
