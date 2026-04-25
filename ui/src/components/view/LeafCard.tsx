import { Show, For } from 'solid-js'
import { useScroll } from '@/utils/hooks/useScroll'
import NPopover from '@/components/common/NPopover'

interface TagItem {
  key: string
  name: string
}

interface CardData {
  name: string
  desc?: string
}

interface CardProps<T extends CardData> {
  ref?: (el: HTMLDivElement) => void
  name: string
  data?: T
  error?: boolean
  tags?: TagItem[]
  onClick: (name: string, tagKey?: string) => void
  onContextMenu: (e: MouseEvent) => void
}

export default function LeafCard<T extends CardData>(props: CardProps<T>) {
  const scroll = useScroll()

  const handleClick = (tagKey?: string) => {
    if (props.data) {
      const target = tagKey ?? props.tags?.[0]?.key
      props.onClick(props.name, target)
    }
  }

  const handleTagClick = (e: MouseEvent, tagKey: string) => {
    e.stopPropagation()
    handleClick(tagKey)
  }

  return (
    <div
      ref={props.ref}
      class="border border-gray-200 rounded-lg p-4 transition-shadow h-38 min-w-54 max-w-72 shrink-0 flex flex-col"
      classList={{
        'hover:shadow-md cursor-pointer': !!props.data,
        'bg-red-50': props.error,
        'bg-gray-50': !props.data && !props.error,
      }}
      onClick={() => handleClick()}
      onContextMenu={props.onContextMenu}
    >
      {}
      <Show when={props.error}>
        <div class="flex-1 flex flex-col items-center justify-center text-red-500">
          <h3 class="text-lg font-medium mb-1">{props.name}</h3>
          <span class="text-sm">加载失败</span>
        </div>
      </Show>

      {}
      <Show when={!props.data && !props.error}>
        <div class="animate-pulse flex-1">
          <div class="h-6 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div class="flex gap-2">
            <div class="h-5 bg-gray-200 rounded w-16"></div>
            <div class="h-5 bg-gray-200 rounded w-12"></div>
          </div>
        </div>
      </Show>

      {}
      <Show when={props.data}>
        <h3 class="text-lg font-medium text-gray-800 mb-2 truncate">{props.data!.name}</h3>
        <NPopover content={props.data!.desc} contentType="markdown" theme="light">
          <p class="text-sm text-gray-500 mb-auto text-wrap line-clamp-2">{props.data!.desc}</p>
        </NPopover>
        <div ref={scroll.ref} class="flex gap-1">
          <For each={props.tags}>
            {(tag) => (
              <p
                onClick={(e) => handleTagClick(e, tag.key)}
                class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs shrink-0 hover:bg-green-200 cursor-pointer"
              >
                {tag.name}
              </p>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
