import { createSignal } from 'solid-js'

export function useStickyBottom() {
  const [isSticky, setIsSticky] = createSignal(false)
  const [sectionHeight, setSectionHeight] = createSignal(0)
  const [actionSectionRef, setActionSectionRef] = createSignal<HTMLElement | undefined>(undefined)
  const [sentinelRef, setSentinelRef] = createSignal<HTMLDivElement | undefined>(undefined)

  let resizeObserver: ResizeObserver | null = null
  let intersectionObserver: IntersectionObserver | null = null

  const initObservers = () => {
    const actionEl = actionSectionRef()
    const sentinelEl = sentinelRef()

    if (actionEl) {
      setSectionHeight(actionEl.offsetHeight)
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setSectionHeight((entry.target as HTMLElement).offsetHeight)
        }
      })
      resizeObserver.observe(actionEl)
    }

    if (sentinelEl) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            setIsSticky(!entry.isIntersecting && entry.boundingClientRect.top > 0)
          }
        },
        {
          rootMargin: '0px 0px -16px 0px',
          threshold: 0,
        },
      )
      intersectionObserver.observe(sentinelEl)
    }
  }

  const cleanupObservers = () => {
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
  }

  return {
    actionSectionRef: setActionSectionRef,
    sentinelRef: setSentinelRef,
    isSticky,
    sectionHeight,
    initObservers,
    cleanupObservers,
  }
}
