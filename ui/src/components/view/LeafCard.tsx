import { Show, For } from 'solid-js'
import { useScroll } from '@/utils/hooks/useScroll'
import NPopover from '@/components/common/NPopover'
import { Pin } from 'lucide-solid'

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

  pinned?: boolean
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
      class="relative border border-gray-200 rounded-lg p-4 transition-shadow h-44 w-full min-w-0 flex flex-col"
      classList={{
        'hover:shadow-md cursor-pointer': !!props.data,
        'bg-red-50': props.error,
        'bg-gray-50': !props.data && !props.error,
      }}
      onClick={() => handleClick()}
      onContextMenu={props.onContextMenu}
    >
      {}
      <Show when={props.pinned}>
        <span class="absolute top-2 right-2 text-amber-500" title="已置顶" aria-label="已置顶">
          <Pin size={14} fill="currentColor" />
        </span>
      </Show>

      {}
      <Show when={props.error}>
        <div class="flex-1 flex flex-col items-center justify-center text-red-500">
          <h3 class="text-lg font-medium mb-1 truncate max-w-full">{props.name}</h3>
          <span class="text-sm">加载失败</span>
        </div>
      </Show>

      {}
      <Show when={!props.data && !props.error}>
        <div class="animate-pulse flex-1">
          <div class="h-6 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div class="flex flex-col flex-wrap content-start gap-1 h-13">
            <div class="h-6 bg-gray-200 rounded-full w-16"></div>
            <div class="h-6 bg-gray-200 rounded-full w-12"></div>
            <div class="h-6 bg-gray-200 rounded-full w-14"></div>
          </div>
        </div>
      </Show>

      {}
      <Show when={props.data}>
        <h3 class="text-lg font-medium text-gray-800 mb-2 truncate pr-5">{props.data!.name}</h3>
        {}
        <div class="min-h-10 mb-auto w-full min-w-0">
          <NPopover content={props.data!.desc} contentType="markdown" theme="light">
            <p class="text-sm text-gray-500 line-clamp-2 wrap-break-word min-w-0 max-w-full">
              {props.data!.desc}
            </p>
          </NPopover>
        </div>
        {}
        <div ref={scroll.ref} class="flex flex-col flex-wrap content-start gap-1 h-13 mt-2">
          <For each={props.tags}>
            {(tag) => (
              <span
                onClick={(e) => handleTagClick(e, tag.key)}
                class="inline-flex items-center justify-center h-6 px-2.5 bg-green-100 text-green-700 rounded-full text-xs leading-none shrink-0 hover:bg-green-200 cursor-pointer"
              >
                {tag.name}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
