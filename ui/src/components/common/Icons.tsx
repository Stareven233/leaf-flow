import { JSX } from 'solid-js'

interface IconProps {
  class?: string
  classList?: Record<string, boolean | undefined>
  size?: number
  viewBox?: string
}

const defaultSize = 4
const defaultViewBox = '0 0 24 24'
const basePathProps = {
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'stroke-width': '2',
}

const resolveClass = (props: IconProps) => {
  const cls = props.class || ''
  const hasSize = /[hw]-/.test(cls)
  const size = props.size ?? (hasSize ? undefined : defaultSize)
  if (size) {
    return (cls ? `${cls} ` : '') + `h-${size} w-${size}`
  }
  return cls
}

const svg = (props: IconProps, children: JSX.Element) => {
  const cls = resolveClass(props)
  const viewBox = props.viewBox || defaultViewBox
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={cls}
      classList={props.classList}
      fill="none"
      viewBox={viewBox}
      stroke="currentColor"
    >
      {children}
    </svg>
  )
}

const svgFilled = (props: IconProps, children: JSX.Element) => {
  const cls = resolveClass(props)
  const viewBox = props.viewBox || defaultViewBox
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={cls}
      classList={props.classList}
      viewBox={viewBox}
      fill="currentColor"
    >
      {children}
    </svg>
  )
}

export const RefreshIcon = (props: IconProps) =>
  svg(
    props,
    <path
      {...basePathProps}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />,
  )

export const ExportIcon = (props: IconProps) =>
  svg(
    props,
    <path {...basePathProps} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
  )

export const GearIcon = (props: IconProps) =>
  svg(
    props,
    <>
      <path
        {...basePathProps}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path {...basePathProps} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </>,
  )

export const DustbinIcon = (props: IconProps) =>
  svg(
    props,
    <path
      {...basePathProps}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />,
  )

export const SimpleArrowLeftIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M15 19l-7-7 7-7" />)

export const SimpleArrowRightIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M9 19l7-7-7-7" />)

export const SimpleArrowDownIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M19 9l-7 7-7-7" />)

export const ArrowUpIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M5 10l7-7m0 0l7 7m-7-7v18" />)

export const PlusIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M12 4v16m8-8H4" />)

export const DeleteIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M6 18L18 6M6 6l12 12" />)

export const FilledPlusIcon = (props: IconProps) => {
  props.viewBox = '0 0 20 20'
  return svgFilled(
    props,
    <path
      clip-rule="evenodd"
      fill-rule="evenodd"
      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
    />,
  )
}

export const FilledMinusIcon = (props: IconProps) => {
  props.viewBox = '0 0 20 20'
  return svgFilled(
    props,
    <path
      clip-rule="evenodd"
      fill-rule="evenodd"
      d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
    />,
  )
}

export const FilledDeleteIcon = (props: IconProps) => {
  props.viewBox = '0 0 20 20'
  return svgFilled(
    props,
    <path
      clip-rule="evenodd"
      fill-rule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
    />,
  )
}

export const ClockIcon = (props: IconProps) =>
  svg(props, <path {...basePathProps} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />)

export const ModuleIcon = (props: IconProps) => {
  return svg(
    props,
    <path
      {...basePathProps}
      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
    />,
  )
}

export const FileIcon = (props: IconProps) => {
  return svg(
    props,
    <path
      {...basePathProps}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />,
  )
}

export const DirectoryIcon = (props: IconProps) => {
  return svg(
    props,
    <path
      {...basePathProps}
      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
    />,
  )
}

export const RoundCheckBoxIcon = (props: IconProps) => {
  return svg(props, <path {...basePathProps} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />)
}

export const CheckBoxIcon = (props: IconProps) => {
  return svg(props, <path {...basePathProps} d="M2 6L5 9L10 3" />)
}

export const QuestionIcon = (props: IconProps) => {
  return svg(props, <path {...basePathProps} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />)
}

export const CircleLoadingIcon = (props: IconProps) => {
  return svg(
    props,
    <>
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </>,
  )
}

export const CopyIcon = (props: IconProps) => {
  props.viewBox = '0 0 1024 1024'
  return svgFilled(
    props,
    <>
      <path d="M672 832 224 832c-52.928 0-96-43.072-96-96L128 160c0-52.928 43.072-96 96-96l448 0c52.928 0 96 43.072 96 96l0 576C768 788.928 724.928 832 672 832zM224 128C206.368 128 192 142.368 192 160l0 576c0 17.664 14.368 32 32 32l448 0c17.664 0 32-14.336 32-32L704 160c0-17.632-14.336-32-32-32L224 128z" />
      <path d="M800 960 320 960c-17.664 0-32-14.304-32-32s14.336-32 32-32l480 0c17.664 0 32-14.336 32-32L832 256c0-17.664 14.304-32 32-32s32 14.336 32 32l0 608C896 916.928 852.928 960 800 960z" />
      <path d="M544 320 288 320c-17.664 0-32-14.336-32-32s14.336-32 32-32l256 0c17.696 0 32 14.336 32 32S561.696 320 544 320z" />
      <path d="M608 480 288.032 480c-17.664 0-32-14.336-32-32s14.336-32 32-32L608 416c17.696 0 32 14.336 32 32S625.696 480 608 480z" />
      <path d="M608 640 288 640c-17.664 0-32-14.304-32-32s14.336-32 32-32l320 0c17.696 0 32 14.304 32 32S625.696 640 608 640z" />
    </>,
  )
}
