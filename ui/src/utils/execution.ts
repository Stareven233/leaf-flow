import type {
  ArgumentValue,
  Argument,
  ArgumentMap,
  ArgumentRenderMap,
  RenderStatus,
  SavedArgument,
  EntryType,
  ModuleMeta,
} from '@/types/project'
import { useMessage } from './hooks/useMessage'

const ARG_TEMP_STORAGE_KEY = 'arg_temp'
const ARG_SAVED_STORAGE_KEY = 'arg_saved'
const SAVED_QUEUE_CAPACITY = 20
const ARG_EXEC_LEGACY_KEY = 'arg_history'
const EXEC_HISTORY_CAPACITY = 20
const PRJ_ORDER_STORAGE_KEY = 'project_order'
const FLOW_ORDER_STORAGE_KEY = 'flow_order'

const arrayRegex = /(?<!#)#\{([^#\{\}]*)#\{([^#\{\}\)\s]+)\}([^#\{\}]*)\}(?:\{([^}]*)\})?/g
const singleRegex = /(?<!#)#\{([^#\{\}\s]+)\}/g
const sharpEscapeRegex = /##\{.*?/g
const hasSpaces = /\s/
const quotedRegex = /^'.*'$|^".*"$/

const checkQuotes = (value: ArgumentValue) => {
  const v = String(value)
  const wrapped = quotedRegex.test(v)
  if (hasSpaces.test(v) && !wrapped) {
    return `"${v}"`
  }
  return v
}

export const isEmpty = (value: any): boolean => {
  if (!value && value !== 0 && typeof value !== 'boolean') {
    return true
  }
  const emptyArray = Array.isArray(value) && value.length === 0
  const emptyObject = typeof value === 'object' && Object.keys(value).length === 0
  return emptyArray || emptyObject
}

const arrayReplacer = (amap: Readonly<ArgumentRenderMap>) => {
  return (match: string, prefix: string, key: string, suffix: string, sep?: string): string => {
    const arg = amap[key]
    let values = arg?.value
    if (!arg || isEmpty(values)) {
      return ''
    }
    if (!Array.isArray(values)) {
      values = [values!]
    }
    return values.map((v) => `${prefix}${v}${suffix}`).join(sep ?? '')
  }
}

const singleReplacer = (amap: Readonly<ArgumentRenderMap>) => {
  return (match: string, key: string): string => {
    const arg = amap[key]
    let value = arg?.value
    if (!arg || isEmpty(value)) {
      return ''
    }
    if (Array.isArray(value)) {
      value = value[0]
    }
    return String(value)
  }
}

export const renderCommand = (template: string, amap: Readonly<ArgumentRenderMap>): string => {
  let result = template.replace(arrayRegex, arrayReplacer(amap))
  result = result.replace(singleRegex, singleReplacer(amap))
  result = result.replace(sharpEscapeRegex, (match) => match.slice(1))
  return result
}

const renderArgumentTemplate = (
  key: string,
  template: string,
  amap: Readonly<ArgumentRenderMap>,
) => {
  const v = amap[key]?.value
  if (isEmpty(v) || v === false) {
    return ''
  }
  template = template.replaceAll('#{}', `#{${key}}`)
  const result = renderCommand(template, amap)
  return result
}

export const toRenderMap = (map: ModuleMeta, key: string = 'value'): ArgumentRenderMap => {
  const ret: ArgumentRenderMap = {}
  for (const [k, v] of Object.entries(map ?? {})) {
    ret[k] = { preRendered: false }
    ret[k][key] = v.value
  }
  return ret
}

export const fromRenderMap = (rmap: ArgumentRenderMap, key?: string): ArgumentMap => {
  const ret: ArgumentMap = {}
  key = key ?? 'rawValue'
  for (const [k, v] of Object.entries(rmap ?? {})) {
    ret[k] = v[key]
  }
  return ret
}

export const gatherArgumentStatus = (
  args: Argument[] | undefined,
  meta?: ModuleMeta,
  renderTemplate?: boolean,
): ArgumentRenderMap => {
  const rmap: ArgumentRenderMap = toRenderMap(meta ?? {}, 'value')
  const tmap = { ...rmap }

  for (const a of args ?? []) {
    const tStatus: RenderStatus = { preRendered: false }
    if (!isEmpty(a.value)) {
      tStatus.value = tStatus.rawValue = a.value
      tStatus.preRendered = rmap[a.key]?.preRendered ?? false
    }

    if (a.dtype === 'file' && a.method === 'mmap') {
      tStatus.preRendered = true
    }

    if (renderTemplate && a.template) {
      tmap[a.key] = tStatus
      tStatus.value = renderArgumentTemplate(a.key, a.template, tmap)
      delete tmap[a.key]
      tStatus.preRendered = true
    }
    rmap[a.key] = tStatus
  }
  return rmap
}

const loadTempStore = (): Record<string, SavedArgument['map']> => {
  const raw = localStorage.getItem(ARG_TEMP_STORAGE_KEY)
  if (!raw) {
    return {}
  }
  const parsed = JSON.parse(raw)
  return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

const saveTempStore = (store: Record<string, SavedArgument['map']>) => {
  if (Object.keys(store).length === 0) {
    localStorage.removeItem(ARG_TEMP_STORAGE_KEY)
  } else {
    localStorage.setItem(ARG_TEMP_STORAGE_KEY, JSON.stringify(store))
  }
}

const tempKey = (type: EntryType, key: string, subKey: string) => `${type}:${key}:${subKey}`

export const saveTemporaryArgument = (
  type: EntryType,
  key: string,
  subKey: string,
  map: ArgumentMap | Record<string, ArgumentMap>,
) => {
  const store = loadTempStore()
  store[tempKey(type, key, subKey)] = map
  saveTempStore(store)
}

export const loadTemporaryArgument = (
  type: EntryType,
  key: string,
  subKey: string,
): SavedArgument['map'] | null => {
  const store = loadTempStore()
  return store[tempKey(type, key, subKey)] ?? null
}

export const clearTemporaryArgument = (type?: EntryType, key?: string, subKey?: string) => {
  if (!type) {
    localStorage.removeItem(ARG_TEMP_STORAGE_KEY)
    return
  }
  const store = loadTempStore()
  if (subKey) {
    delete store[tempKey(type, key!, subKey)]
  } else {
    const prefix = `${type}:${key!}:`
    for (const k of Object.keys(store)) {
      if (k.startsWith(prefix)) delete store[k]
    }
  }
  saveTempStore(store)
}

export const isArgumentsEqual = (a: any, b: any): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isArgumentsEqual(a[i], b[i])) return false
    }
    return true
  }
  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()
  if (keysA.length !== keysB.length) return false
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]
    if (key !== keysB[i]) return false
    if (!isArgumentsEqual(a[key], b[key])) return false
  }
  return true
}

const queuePartitionKey = (type: EntryType, key: string) => `${type}:${key}`

const loadSavedQueueStore = (): Record<string, SavedArgument[]> => {
  const raw = localStorage.getItem(ARG_SAVED_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch (e) {
      console.error('Failed to parse saved queue store:', e)
    }
  }

  const legacyRaw = localStorage.getItem(ARG_EXEC_LEGACY_KEY)
  if (legacyRaw) {
    try {
      const legacyList = JSON.parse(legacyRaw)
      if (Array.isArray(legacyList)) {
        const migrated: Record<string, SavedArgument[]> = {}
        for (const item of legacyList) {
          if (item && item.type && item.key) {
            const pKey = queuePartitionKey(item.type, item.key)
            if (!migrated[pKey]) migrated[pKey] = []
            migrated[pKey].push(item)
            if (migrated[pKey].length > SAVED_QUEUE_CAPACITY) {
              migrated[pKey].shift()
            }
          }
        }
        localStorage.setItem(ARG_SAVED_STORAGE_KEY, JSON.stringify(migrated))
        localStorage.removeItem(ARG_EXEC_LEGACY_KEY)
        return migrated
      }
    } catch (e) {
      console.error('Failed to migrate legacy execution history:', e)
    }
  }

  return {}
}

const saveSavedQueueStore = (store: Record<string, SavedArgument[]>) => {
  if (Object.keys(store).length === 0) {
    localStorage.removeItem(ARG_SAVED_STORAGE_KEY)
  } else {
    localStorage.setItem(ARG_SAVED_STORAGE_KEY, JSON.stringify(store))
  }
}

export interface SaveQueueResult {
  saved: boolean
  reason?: 'duplicate' | 'error'
}

export const saveQueueArgument = (
  type: EntryType,
  key: string,
  subKey: string,
  map: ArgumentMap | Record<string, ArgumentMap>,
): SaveQueueResult => {
  const store = loadSavedQueueStore()
  const pKey = queuePartitionKey(type, key)
  const list = store[pKey] ? [...store[pKey]] : []

  const lastSameSubKey = [...list].reverse().find((item) => item.subKey === subKey)
  if (lastSameSubKey && isArgumentsEqual(lastSameSubKey.map, map)) {
    return { saved: false, reason: 'duplicate' }
  }

  list.push({ type, key, subKey, map })
  while (list.length > SAVED_QUEUE_CAPACITY) {
    list.shift()
  }

  store[pKey] = list
  saveSavedQueueStore(store)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('saved-arguments-updated', { detail: { type, key, subKey } }),
    )
  }

  return { saved: true }
}

export const loadQueueArguments = (
  type?: EntryType,
  key?: string,
  subKey?: string,
): { index: number; item: SavedArgument }[] => {
  const store = loadSavedQueueStore()
  if (type && key) {
    const pKey = queuePartitionKey(type, key)
    const list = store[pKey] || []
    return list
      .map((item, index) => ({ index, item }))
      .filter(({ item }) => !subKey || item.subKey === subKey)
      .reverse()
  }

  const all: { index: number; item: SavedArgument }[] = []
  for (const list of Object.values(store)) {
    list.forEach((item, index) => {
      if (
        (!type || item.type === type) &&
        (!key || item.key === key) &&
        (!subKey || item.subKey === subKey)
      ) {
        all.push({ index, item })
      }
    })
  }
  return all.reverse()
}

export const clearQueueArgument = (type: EntryType, key: string, indices?: number[]) => {
  const store = loadSavedQueueStore()
  const pKey = queuePartitionKey(type, key)
  const list = store[pKey]
  if (!list || list.length === 0) return

  if (!indices || indices.length === 0) {
    delete store[pKey]
  } else {
    const validIndices = new Set(
      indices.filter((i) => Number.isInteger(i) && i >= 0 && i < list.length),
    )
    if (validIndices.size === 0) return
    const next = list.filter((_, i) => !validIndices.has(i))
    if (next.length === 0) {
      delete store[pKey]
    } else {
      store[pKey] = next
    }
  }

  saveSavedQueueStore(store)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('saved-arguments-updated', { detail: { type, key } }))
  }
}

export const saveExecutedArgument = (
  type: EntryType,
  key: string,
  subKey: string,
  map: ArgumentMap | Record<string, ArgumentMap>,
) => {
  saveQueueArgument(type, key, subKey, map)
}

export const loadExecutedArguments = (type?: EntryType, key?: string, subKey?: string) => {
  return loadQueueArguments(type, key, subKey)
}

export const clearExecutedArgument = (indices: number[], type?: EntryType, key?: string) => {
  if (type && key) {
    clearQueueArgument(type, key, indices)
  }
}

export const saveConfigMTime = (
  times: Record<string, number>,
  type: 'project' | 'flow' = 'project',
) => {
  const key = type === 'project' ? PRJ_ORDER_STORAGE_KEY : FLOW_ORDER_STORAGE_KEY
  localStorage.setItem(key, JSON.stringify(times))
}

export const loadConfigMTime = (type: 'project' | 'flow' = 'project'): Record<string, number> => {
  const key = type === 'project' ? PRJ_ORDER_STORAGE_KEY : FLOW_ORDER_STORAGE_KEY
  const raw = localStorage.getItem(key)
  if (!raw) {
    return {}
  }
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  return parsed as Record<string, number>
}

export const invalidArgument = (arg: Argument): boolean => {
  return !!arg.required && isEmpty(arg.value) && !(arg.dtype === 'file' && arg.method === 'mmap')
}

export const validateRequiredArguments = (args?: Argument[], alert: boolean = false): boolean => {
  if (!args) {
    return true
  }
  const missing: string[] = []
  for (const arg of args) {
    if (invalidArgument(arg)) {
      missing.push(arg.name)
    }
  }
  if (missing.length > 0 && alert) {
    const display = missing.slice(0, 5).join('、')
    const suffix = missing.length > 5 ? '...' : ''
    useMessage().error(`有必填参数未填写：${display}${suffix}`)
  }
  return missing.length === 0
}
