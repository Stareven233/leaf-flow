import { createSignal, onCleanup } from 'solid-js'

export function useGridColumns() {
  const [columns, setColumns] = createSignal(1)

  let el: HTMLElement | undefined
  let ro: ResizeObserver | undefined

  const read = () => {
    if (!el) {
      return
    }
    const tracks = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
    if (tracks > 0) {
      setColumns(tracks)
    }
  }

  const ref = (node: HTMLElement) => {
    el = node
    ro = new ResizeObserver(read)
    ro.observe(node)
    read()
    onCleanup(() => {
      ro?.disconnect()
      ro = undefined
      el = undefined
    })
  }

  return { ref, columns }
}
