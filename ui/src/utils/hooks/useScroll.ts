import { onCleanup, type JSX } from 'solid-js'

export interface UseScrollOptions {
  direction?: 'horizontal' | 'vertical' | 'both'

  preventDefault?: boolean

  speed?: number

  className?: string
}

export interface UseScrollReturn {
  ref: (el: HTMLElement) => void

  scrollTo: (options: { left?: number; top?: number; behavior?: ScrollBehavior }) => void

  getScrollPosition: () => { left: number; top: number }
}

export function useScroll(options: UseScrollOptions = {}): UseScrollReturn {
  const { direction = 'horizontal', preventDefault = true, speed = 1 } = options

  let containerRef: HTMLElement | null = null

  const handleWheel = (e: WheelEvent) => {
    if (!containerRef) {
      return
    }

    e.stopPropagation()

    const el = containerRef
    let canScroll = false

    if (direction === 'horizontal' && e.deltaY !== 0) {
      const atStart = el.scrollLeft === 0 && e.deltaY < 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth && e.deltaY > 0
      canScroll = !atStart && !atEnd
    } else if (direction === 'vertical' && e.deltaY !== 0) {
      const atStart = el.scrollTop === 0 && e.deltaY < 0
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight && e.deltaY > 0
      canScroll = !atStart && !atEnd
    } else if (direction === 'both') {
      canScroll = true
    }

    if (canScroll) {
      if (preventDefault) {
        e.preventDefault()
      }
      switch (direction) {
        case 'horizontal':
          el.scrollLeft += e.deltaY * speed
          break
        case 'vertical':
          el.scrollTop += e.deltaY * speed
          break
        default:
          el.scrollLeft += e.deltaX * speed
          el.scrollTop += e.deltaY * speed
      }
    } else {
      if (preventDefault) {
        e.preventDefault()
      }
    }
  }

  const ref = (el: HTMLElement) => {
    containerRef = el

    const baseClasses = getBaseClasses(direction)
    baseClasses.forEach((cls) => {
      if (!el.classList.contains(cls)) {
        el.classList.add(cls)
      }
    })

    el.addEventListener('wheel', handleWheel, { passive: false })

    onCleanup(() => {
      el.removeEventListener('wheel', handleWheel)
      baseClasses.forEach((cls) => el.classList.remove(cls))
    })
  }

  const scrollTo = (options: { left?: number; top?: number; behavior?: ScrollBehavior }) => {
    containerRef?.scrollTo(options)
  }

  const getScrollPosition = () => ({
    left: containerRef?.scrollLeft ?? 0,
    top: containerRef?.scrollTop ?? 0,
  })

  return {
    ref,
    scrollTo,
    getScrollPosition,
  }
}

function getBaseClasses(direction: UseScrollOptions['direction']): string[] {
  const classes = ['no-scrollbar']

  switch (direction) {
    case 'horizontal':
      classes.push('flex', 'whitespace-nowrap', 'overflow-x-scroll', 'overflow-y-hidden')
      break
    case 'vertical':
      classes.push('flex', 'flex-col', 'overflow-y-scroll', 'overflow-x-hidden')
      break
    case 'both':
      classes.push('overflow-scroll')
      break
  }

  return classes
}

export function mergeRefs<T>(...refs: ((el: T) => void)[]) {
  return (el: T) => {
    refs.forEach((ref) => ref(el))
  }
}

export type ScrollContainerProps = {
  children: JSX.Element
  direction?: UseScrollOptions['direction']
  speed?: number
  class?: string
  onScroll?: (position: { left: number; top: number }) => void
}
