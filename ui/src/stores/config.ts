import { createSignal } from 'solid-js'
import type { Config } from '@/types/file'
import { fetchConfig } from '@/apis/project'
import { absolutePath } from '@/apis/file'
import * as path from '@/utils/path'

const [data, setData] = createSignal<Config>()
const [cachedRootDir, setCachedRootDir] = createSignal<string>()
let fetchPromise: Promise<Config> | null = null
let rootDirPromise: Promise<string> | null = null

const clearRootDirCache = () => {
  setCachedRootDir(undefined)
  rootDirPromise = null
}

export function useConfigStore() {
  const fetch = async (force: boolean = true) => {
    if (!force && data()) {
      return data()!
    }

    if (!force && fetchPromise) {
      return fetchPromise
    }

    const request = fetchConfig()
      .then((config) => {
        setData(config)
        clearRootDirCache()
        console.log('fetch new config: ', config)
        return config
      })
      .finally(() => {
        if (fetchPromise === request) {
          fetchPromise = null
        }
      })

    fetchPromise = request
    return request
  }

  const rootDir = async (force: boolean = false): Promise<string> => {
    if (force) {
      clearRootDirCache()
    } else {
      const cached = cachedRootDir()
      if (cached) {
        return cached
      }
      if (rootDirPromise) {
        return rootDirPromise
      }
    }

    const request = (async () => {
      const root = path.normalize(await absolutePath('.'))
      setCachedRootDir(root)
      return root
    })()

    rootDirPromise = request
    try {
      return await request
    } finally {
      if (rootDirPromise === request) {
        rootDirPromise = null
      }
    }
  }

  return {
    data,
    fetch,
    rootDir,
  }
}
