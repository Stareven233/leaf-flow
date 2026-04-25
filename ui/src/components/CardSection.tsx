import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { useScroll } from '@/utils/hooks/useScroll'

interface CardSectionProps {
  title: string

  emptyText?: string
  hasItems: boolean
  children: JSX.Element
}

export default function CardSection(props: CardSectionProps) {
  const scroll = useScroll()

  return (
    <Show
      when={props.hasItems}
      fallback={
        props.emptyText ? (
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">{props.title}</h2>
            <div class="col-span-full text-center py-8 text-gray-500">{props.emptyText}</div>
          </div>
        ) : null
      }
    >
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">{props.title}</h2>
        <div ref={scroll.ref} class="flex gap-4 pb-4">
          {props.children}
        </div>
      </div>
    </Show>
  )
}
