import { createSignal } from 'solid-js'

interface LazyLoadOptions<T> {
  getNames: () => string[]

  getItem: (name: string) => T | undefined

  fetchBatch: (names: string[]) => Promise<(T | null)[]>

  loadItem: (item: T) => void

  batchSize?: number

  logPrefix?: string
}

export interface LazyLoadReturn {
  registerRef: (el: HTMLDivElement, name: string) => void

  unregisterRef: (el: HTMLDivElement) => void

  isFailed: (name: string) => boolean

  init: () => void

  destroy: () => void
}

export function useLazyLoad<T>(options: LazyLoadOptions<T>): LazyLoadReturn {
  const { getNames, getItem, fetchBatch, loadItem, batchSize = 6, logPrefix = 'LazyLoad' } = options

  const [failed, setFailed] = createSignal(new Set<string>())

  let chain = Promise.resolve()
  let observer: IntersectionObserver | null = null
  const elementMap = new Map<Element, string>()

  const markFailed = (names: string[]) => {
    setFailed((prev) => {
      const s = new Set(prev)
      names.forEach((n) => s.add(n))
      return s
    })
  }

  const loadBatch = async (startName: string) => {
    const names = getNames()
    const startIndex = names.indexOf(startName)
    if (startIndex === -1) {
      return
    }

    const toLoad = names
      .slice(startIndex, startIndex + batchSize)
      .filter((n) => !getItem(n) && !failed().has(n))

    if (toLoad.length === 0) {
      return
    }

    let processingIndex = -1
    try {
      const results = await fetchBatch(toLoad)

      if (results.length === 0) {
        markFailed(toLoad)
        return
      }

      results.forEach((item, index) => {
        processingIndex = index
        const name = toLoad[index]
        if (!name) {
          return
        }
        if (item) {
          loadItem(item)
        } else {
          markFailed([name])
        }
      })
    } catch (e) {
      console.error(`${logPrefix} batch load failed`, e)
      markFailed(processingIndex === -1 ? toLoad : [toLoad[processingIndex]])
    }
  }

  const handleIntersect = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return
      }
      const name = elementMap.get(entry.target)
      if (!name || getItem(name) || failed().has(name)) {
        return
      }
      chain = chain
        .then(async () => {
          if (!getItem(name)) await loadBatch(name)
        })
        .catch((err) => console.error(`${logPrefix} chain error:`, err))
    })
  }

  const registerRef = (el: HTMLDivElement, name: string) => {
    if (!el || elementMap.has(el)) {
      return
    }
    elementMap.set(el, name)
    observer?.observe(el)
  }

  const unregisterRef = (el: HTMLDivElement) => {
    if (!elementMap.has(el)) {
      return
    }
    elementMap.delete(el)
    observer?.unobserve(el)
  }

  const init = () => {
    observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    })
  }

  const destroy = () => {
    observer?.disconnect()
    observer = null
    elementMap.clear()
  }

  return {
    registerRef,
    unregisterRef,
    isFailed: (name) => failed().has(name),
    init,
    destroy,
  }
}
