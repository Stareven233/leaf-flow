import { createEffect, createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { NMarkdown } from '@/components/common/NMarkdown'
import { useScroll } from '@/utils/hooks/useScroll'
import { clsx } from 'clsx'

type NPopoverTheme = 'dark' | 'light'
type NPopoverContentType = 'markdown' | 'plaintext'
type NPopoverPlacement = 'top' | 'bottom'

interface NPopoverProps {
  content?: string
  contentType?: NPopoverContentType
  theme?: NPopoverTheme
  children: JSX.Element
}

const NPopover = (props: NPopoverProps) => {
  const [visible, setVisible] = createSignal(false)
  const [placement, setPlacement] = createSignal<NPopoverPlacement>('top')
  const [popoverStyle, setPopoverStyle] = createSignal<Record<string, string>>({})
  const scroll = useScroll({ direction: 'vertical' })
  let triggerRef: HTMLElement | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined

  const contentType = () => props.contentType ?? 'plaintext'
  const isMarkdown = () => contentType() === 'markdown'
  const isLightTheme = () => (props.theme ?? 'dark') === 'light'
  const popText = () => props.content ?? ''

  const clearCloseTimer = () => {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = undefined
    }
  }

  const openPopover = () => {
    clearCloseTimer()
    setVisible(true)
  }

  const closePopover = () => {
    clearCloseTimer()
    closeTimer = setTimeout(() => setVisible(false), 100)
  }

  const updatePosition = () => {
    if (!triggerRef) {
      return
    }

    const rect = triggerRef.getBoundingClientRect()
    const viewportPadding = 12
    const gap = 6
    const maxWidth = isMarkdown() ? 320 : 256
    const safeMaxWidth = Math.min(maxWidth, Math.max(160, window.innerWidth - viewportPadding * 2))
    const preferredHeight = isMarkdown() ? 220 : 96
    const spaceAbove = rect.top - viewportPadding - gap
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap
    const nextPlacement =
      spaceAbove >= preferredHeight || spaceAbove >= spaceBelow ? 'top' : 'bottom'
    const availableHeight = Math.max(
      72,
      Math.min(240, nextPlacement === 'top' ? spaceAbove : spaceBelow),
    )
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - safeMaxWidth - viewportPadding),
    )

    setPlacement(nextPlacement)
    setPopoverStyle({
      left: `${left}px`,
      'max-width': `${safeMaxWidth}px`,
      ...(isMarkdown() ? { width: `${safeMaxWidth}px` } : {}),
      ...(nextPlacement === 'top'
        ? { bottom: `${window.innerHeight - rect.top + gap}px` }
        : { top: `${rect.bottom + gap}px` }),
      '--n-popover-max-height': `${availableHeight}px`,
    })
  }

  createEffect(() => {
    if (!visible() || !popText()) {
      return
    }

    queueMicrotask(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    onCleanup(() => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    })
  })

  onCleanup(clearCloseTimer)

  const ArrowBlock = (props: { place: NPopoverPlacement }) => {
    const top = props.place === 'top'
    const light = isLightTheme()

    const cls = clsx(
      'w-0 h-0 border-l-6 border-r-6 border-l-transparent border-r-transparent',
      top ? 'border-t-8' : 'border-b-8',
      light ? 'border-gray-50/85' : 'border-black/75',
    )

    return (
      <div class="ml-3">
        <div class={cls} />
      </div>
    )
  }

  return (
    <Show when={popText()} fallback={props.children}>
      <section
        ref={triggerRef}
        class="relative inline-block"
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
      >
        {props.children}
        <Show when={visible() && popText()}>
          <Portal>
            <div
              class="fixed z-60"
              style={popoverStyle()}
              onMouseEnter={openPopover}
              onMouseLeave={closePopover}
            >
              <Show when={placement() === 'bottom'}>
                <ArrowBlock place={placement()} />
              </Show>

              <div
                class={
                  isLightTheme()
                    ? 'bg-white/80 text-gray-900 backdrop-blur-sm text-xs rounded-md px-3 py-2 shadow-lg leading-relaxed border border-gray-200'
                    : 'bg-black/75 text-gray-100 backdrop-blur-sm text-xs rounded-md px-3 py-2 shadow-lg leading-relaxed'
                }
              >
                <Show when={isMarkdown()} fallback={popText()}>
                  <div
                    ref={scroll.ref}
                    class="min-w-0 wrap-break-word pr-1"
                    style={{ 'max-height': 'var(--n-popover-max-height)' }}
                  >
                    {}
                    <NMarkdown content={popText()} theme={props.theme ?? 'dark'} />
                  </div>
                </Show>
              </div>

              <Show when={placement() === 'top'}>
                <ArrowBlock place={placement()} />
              </Show>
            </div>
          </Portal>
        </Show>
      </section>
    </Show>
  )
}

export default NPopover
