import * as exec from '@/utils/execution'

export function useTemporaryArguments<TData = any>(
  type: 'flow' | 'project',
  getKey: () => string | undefined,
  getSubKey: () => string | undefined,
  store: {
    isTempArgsLoaded: (key: string, subKey: string) => boolean
    markTempArgsLoaded: (key: string, subKey: string) => void
  },
  applyValues: (tempData: TData) => void,
  collectData: () => TData | undefined,
) {
  const load = () => {
    const key = getKey()
    const subKey = getSubKey()
    if (!key || !subKey) {
      return
    }

    if (store.isTempArgsLoaded(key, subKey)) {
      return
    }

    const tempData = exec.loadTemporaryArgument(type, key, subKey) as TData | null
    if (!tempData) {
      store.markTempArgsLoaded(key, subKey)
      return
    }

    applyValues(tempData)
    store.markTempArgsLoaded(key, subKey)
  }

  const save = () => {
    const key = getKey()
    const subKey = getSubKey()
    const data = collectData()
    if (!key || !subKey || !data) {
      return
    }

    exec.saveTemporaryArgument(type, key, subKey, data)
  }

  const clear = () => {
    const key = getKey()
    const subKey = getSubKey()
    if (key && subKey) {
      exec.clearTemporaryArgument(type, key, subKey)
    }
  }

  return { load, save, clear }
}
