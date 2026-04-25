import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import NPopover from '@/components/common/NPopover'
import type { ArgumentDType, ArgumentMethod } from '@/types/project'
import type { ArgumentInputProps } from './types'
import type { Argument } from '@/types/project'
import { RoundCheckBoxIcon } from '@/components/common/Icons'
import { invalidArgument } from '@/utils/execution'

import PathInput from './PathInput'
import NumberInput from './NumberInput'
import SliderInput from './SliderInput'
import StringInput from './StringInput'
import BooleanInput from './BooleanInput'
import RadioInput from './RadioInput'
import SelectInput from './SelectInput'
import SwitchInput from './SwitchInput'
import ArrayWrapper from './ArrayWrapper'

export const getComponent = (
  dtype?: ArgumentDType,
  method?: ArgumentMethod,
): Component<ArgumentInputProps> => {
  switch (dtype || 'string') {
    case 'file':
    case 'directory':
      return PathInput
    case 'string':
      if (method === 'select') {
        return SelectInput
      } else if (method === 'radio') {
        return RadioInput
      }
      return StringInput
    case 'number':
      if (method === 'select') {
        return SelectInput
      } else if (method === 'slide') {
        return SliderInput
      } else if (method === 'radio') {
        return RadioInput
      }
      return NumberInput
    case 'boolean':
      return method === 'switch' ? SwitchInput : BooleanInput
    default:
      return StringInput
  }
}

interface ArgumentRowProps {
  argument: Argument
  setArgument: (updates: Partial<Argument>) => void
}

const ArgumentRow = (props: ArgumentRowProps) => {
  const arg = props.argument
  const dtype = props.argument.dtype
  const Component = getComponent(dtype, arg.method)
  const isInvalid = () => invalidArgument(arg)
  const popoverContent = createMemo(() => {
    const contents: string[] = []
    if (isInvalid()) {
      contents.push('[必填]')
    }
    if (arg.desc) {
      contents.push(arg.desc)
    }
    return contents.join(' ')
  })

  return (
    <div>
      <h5
        class="inline-flex items-center gap-2 mt-2 mb-1 text-sm font-medium text-gray-700 pr-2 py-1 rounded transition-colors"
        classList={{ 'bg-orange-50 border-l-2 border-orange-400': isInvalid() }}
      >
        <RoundCheckBoxIcon
          classList={{ 'text-green-300': !isInvalid(), 'text-orange-300': isInvalid() }}
        />
        <NPopover content={popoverContent()}>
          <span class="font-semibold">
            {props.argument.name}
            <Show when={props.argument.required}>
              <span class="text-red-500 text-md">*</span>
            </Show>
          </span>
        </NPopover>
      </h5>
      <Show
        when={
          props.argument.multiple &&
          props.argument.method !== 'radio' &&
          dtype !== 'file' &&
          dtype !== 'directory'
        }
        fallback={<Component argument={props.argument} setArgument={props.setArgument} />}
      >
        <ArrayWrapper
          argument={props.argument}
          setArgument={props.setArgument}
          innerComponent={Component}
        />
      </Show>
    </div>
  )
}

export {
  ArgumentRow,
  PathInput,
  NumberInput,
  SliderInput,
  StringInput,
  BooleanInput,
  RadioInput,
  SelectInput,
}
