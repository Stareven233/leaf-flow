import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

interface CardSectionProps {
  title: string

  emptyText?: string
  hasItems: boolean
  children: JSX.Element

  noMatchText?: string

  filterNoMatch?: boolean

  countLabel?: string

  sectionRef?: (el: HTMLElement) => void
}

export default function CardSection(props: CardSectionProps) {
  const body = () => {
    if (props.filterNoMatch) {
      return (
        <div class="col-span-full text-center py-8 text-gray-500">
          {props.noMatchText ?? '无匹配'}
        </div>
      )
    }
    if (props.hasItems) {
      return (
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {props.children}
        </div>
      )
    }
    if (props.emptyText) {
      return <div class="col-span-full text-center py-8 text-gray-500">{props.emptyText}</div>
    }
    return null
  }

  const visible = () => props.hasItems || props.filterNoMatch || !!props.emptyText

  return (
    <Show when={visible()}>
      <section ref={props.sectionRef} class="bg-white rounded-lg shadow p-6 scroll-mt-4">
        <h2 class="text-xl font-semibold mb-4 flex items-baseline gap-2">
          <span>{props.title}</span>
          <Show when={props.countLabel}>
            <span class="text-sm font-normal text-gray-400">{props.countLabel}</span>
          </Show>
        </h2>
        {body()}
      </section>
    </Show>
  )
}
