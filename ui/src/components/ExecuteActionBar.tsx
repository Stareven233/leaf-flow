import { Show, For } from 'solid-js'
import NButton from '@/components/common/NButton'
import { DeleteIcon, CopyIcon } from '@/components/common/Icons'
import { useScroll } from '@/utils/hooks/useScroll'

interface ActionBarProps {
  isSticky: boolean
  sectionHeight: number
  actionSectionRef: (el: HTMLElement) => void
  sentinelRef: (el: HTMLDivElement) => void
  isExecuting: boolean
  executionInfo: string
  previewCommands: string[]
  onSave: () => void
  onClear: () => void
  onPreview: () => void
  onExecute: () => void
  onClosePreview: () => void
}

export default function ExecuteActionBar(props: ActionBarProps) {
  const scroll = useScroll({ direction: 'vertical' })

  return (
    <>
      {}
      <Show when={props.isSticky}>
        <div style={{ height: `${props.sectionHeight}px` }} class="mt-6"></div>
      </Show>

      <section
        ref={props.actionSectionRef}
        class={`mx-auto p-6 bg-white shadow-sm rounded-lg w-full max-w-420 ${
          props.isSticky
            ? 'fixed bottom-4 left-1/2 -translate-x-1/2 z-2 shadow-xl border border-gray-100'
            : 'mt-6'
        }`}
      >
        {}
        <div class="flex justify-between">
          <div class="flex justify-start gap-3">
            <NButton onClick={props.onSave} variant="secondary">
              暂存
            </NButton>
            <NButton onClick={props.onClear} variant="secondary">
              清理暂存
            </NButton>
          </div>
          <div class="flex gap-3">
            <NButton onClick={props.onPreview} variant="secondary">
              预览
            </NButton>
            <NButton onClick={props.onExecute} disabled={props.isExecuting}>
              <Show when={props.isExecuting}>
                <span class="inline-block animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
              </Show>
              {props.isExecuting ? '执行中...' : '执行'}
            </NButton>
          </div>
        </div>

        {}
        <Show when={props.executionInfo || props.previewCommands.length > 0}>
          <div class="mt-4 p-4 rounded-md bg-green-50 border border-green-200 relative">
            {}
            <Show when={props.executionInfo}>
              <p class="text-gray-700">{props.executionInfo}</p>
            </Show>

            {}
            <Show when={props.previewCommands.length > 0}>
              <NButton
                variant="custom"
                onClick={() => navigator.clipboard.writeText(props.previewCommands.join('\n'))}
                class="absolute top-2 right-10 p-1 hover:bg-green-100 rounded"
              >
                <CopyIcon class="text-gray-600" />
              </NButton>
              <NButton
                onClick={props.onClosePreview}
                variant="custom"
                class="absolute top-2 right-2 p-1 hover:bg-green-100 rounded"
              >
                <DeleteIcon class="text-gray-600" />
              </NButton>
              <p class="text-sm text-gray-600 mb-3">命令预览：</p>
              {}
              <div ref={scroll.ref} class="max-h-60">
                <For each={props.previewCommands}>
                  {(cmd, index) => {
                    const itemScroll = useScroll()
                    return (
                      <div class="mb-3 last:mb-0 text-sm flex items-center">
                        <span class="mr-2 text-gray-600 select-none">{index() + 1}#</span>
                        <div ref={itemScroll.ref} class="bg-white p-2 py-1 rounded-md">
                          {cmd}
                        </div>
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </section>

      {}
      <div ref={props.sentinelRef} class="h-px w-full pointer-events-none opacity-0"></div>
    </>
  )
}
