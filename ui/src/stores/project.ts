import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { Project, ArgumentSetter } from '@/types/project'
import { fetchProject } from '@/apis/project'
import dBind from '@/utils/dynamicBind'

const [data, setData] = createStore<Record<string, Project>>({})
const [isLoading, setIsLoading] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)

export function useProjectStore() {
  const load = (pobj: Project) => {
    setIsLoading(true)
    if (!pobj) {
      throw new Error('Project object is required')
    }

    const pkey = pobj.key
    if (pkey.includes('.')) {
      throw new Error(`Dot '.' cannot be used in project.key, but got '${pkey}'`)
    }
    const mSet = new Set<string>()
    const aSet = new Set<string>()

    let mIndex = 0
    for (const mobj of pobj.modules) {
      const mkey = mobj.key
      if (mkey.includes('.')) {
        throw new Error(`Dot '.' cannot be used in module.key, but got '${mkey}'`)
      }
      if (mkey in mSet) {
        throw new Error(`Duplicate module key: '${mkey}' in project '${pkey}'`)
      }
      if (!mobj.name) {
        mobj.name = mkey
      }
      if (!mobj.arguments) {
        mobj.arguments = []
      }
      aSet.clear()
      for (const argument of mobj.arguments) {
        if (aSet.has(argument.key)) {
          throw new Error(`Duplicate argument key: '${argument.key}' in module '${pkey}.${mkey}'`)
        }
        aSet.add(argument.key)
      }
      mSet.add(mkey)
      const _set: ArgumentSetter = setData.bind(null, pkey, 'modules', mIndex, 'arguments')
      const key = dBind.uniqueKey('P', pkey, mkey)
      dBind.init(key, _set, mobj)
      mIndex++
    }

    setData(pkey, pobj)
    setIsLoading(false)
  }

  const get = (key: string): Project | undefined => {
    return data[key]
  }

  const fetch = async (
    key: string,
    patches?: string[],
    force: boolean = false,
  ): Promise<Project | null> => {
    let p = get(key)
    if (force || !p || !p.modules) {
      const np = await fetchProject(key, patches)
      if (!np) {
        return null
      }
      p = np
      load(np)
    }
    return p
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
