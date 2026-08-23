import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronLeft, ChevronRight } from 'lucide-solid'

export const CARD_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

interface PageState {
  page: number
  pageCount: number
  onPage: (p: number) => void
}

interface CardSectionProps {
  title: string

  emptyText?: string
  hasItems: boolean
  children: JSX.Element

  noMatchText?: string

  filterNoMatch?: boolean

  countLabel?: string

  pager?: PageState

  sectionRef?: (el: HTMLElement) => void
}

export default function CardSection(props: CardSectionProps) {
  const commitPageInput = (el: HTMLInputElement) => {
    const pager = props.pager
    if (!pager) {
      return
    }
    const n = Math.min(Math.max(1, Number.parseInt(el.value, 10) || 1), pager.pageCount)
    el.value = String(n)
    if (n !== pager.page) {
      pager.onPage(n)
    }
  }

  const body = () => {
    if (props.filterNoMatch) {
      return (
        <div class="col-span-full text-center py-8 text-gray-500">
          {props.noMatchText ?? '无匹配'}
        </div>
      )
    }
    if (props.hasItems) {
      return <div class={`${CARD_GRID_CLASS} gap-4`}>{props.children}</div>
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
        {}
        <div class="flex items-center mb-4 gap-2">
          <h2 class="text-xl font-semibold flex items-baseline gap-2">
            <span>{props.title}</span>
            <Show when={props.countLabel}>
              <span class="text-sm font-normal text-gray-400">{props.countLabel}</span>
            </Show>
          </h2>
          <Show when={!!props.pager && props.pager.pageCount > 1}>
            <nav
              class="ml-auto flex items-center gap-1 text-sm text-gray-500"
              aria-label={`「${props.title}」翻页`}
            >
              <button
                type="button"
                class="p-1 rounded text-gray-500 hover:bg-green-50 hover:text-green-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                disabled={props.pager!.page <= 1}
                onClick={() => props.pager!.onPage(props.pager!.page - 1)}
                aria-label="上一页"
                title="上一页"
              >
                <ChevronLeft size={16} />
              </button>
              {}
              <input
                type="text"
                inputmode="numeric"
                class="w-9 px-1 py-0.5 text-center text-sm border border-gray-200 rounded tabular-nums focus:outline-none focus:ring-2 focus:ring-green-200"
                value={props.pager!.page}
                aria-label={`跳转页码，共 ${props.pager!.pageCount} 页`}
                title="输入页码后回车"
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.isComposing || e.keyCode === 229) {
                    return
                  }
                  if (e.key === 'Enter') {
                    commitPageInput(e.currentTarget)
                  }
                }}
                onBlur={(e) => commitPageInput(e.currentTarget)}
              />
              <span class="select-none">/ {props.pager!.pageCount}</span>
              <button
                type="button"
                class="p-1 rounded text-gray-500 hover:bg-green-50 hover:text-green-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                disabled={props.pager!.page >= props.pager!.pageCount}
                onClick={() => props.pager!.onPage(props.pager!.page + 1)}
                aria-label="下一页"
                title="下一页"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </Show>
        </div>
        {body()}
      </section>
    </Show>
  )
}
