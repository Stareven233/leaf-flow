import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Flow } from '@/types/project'
import { fetchFlow } from '@/apis/project'

const [data, setData] = createStore<Record<string, Flow>>({})
const [isLoading, setIsLoading] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)

export function useFlowStore() {
  const load = (fobj: Flow) => {
    setIsLoading(true)
    if (!fobj) {
      throw new Error('Flow data is required')
    }

    setData(fobj.key, fobj)
    setIsLoading(false)
  }

  const get = (key: string) => {
    return data[key]
  }

  const fetch = async (key: string, force: boolean = false) => {
    let f = get(key)
    if (force || !f || !f.branches) {
      const nf = await fetchFlow(key)
      if (!nf) {
        return null
      }
      f = nf
      load(nf)
    }
    return f
  }

  return {
    isLoading,
    fetch,
    get,
    set: setData,
    load,
    error,
    setError,
  }
}
