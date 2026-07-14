import type { Module, Argument, DynamicBind, ArgumentSetter, ModuleMeta } from '@/types/project'
import { readFile, listEntries, queryPathType } from '@/apis/file'
import { parse as yamlParse } from 'yaml'
import { suffix as pathSuffix } from '@/utils/path'
import _ from 'lodash'

interface VariedBind {
  isDirect: boolean
  refKey: string
  srcAttr: string
  valuePath?: string
  destAttr: string
}

const fromRE = /^#(\{\{?)([^}]+)\}?\}$/
const argFromRE = /^(\w+\()?(.+?)(\)[^\(\)]*)?$/
const funcMapping: { [key: string]: <T extends { length: number }>(obj: T) => any } = {
  keys: Object.keys,
  values: Object.values,
  len: (obj) => obj.length,
}

const variedBindCache = new Map<string, Map<string, VariedBind[]>>()
const argIndexCache = new Map<string, Map<string, number>>()

const uniqueKey = (type: 'P' | 'F', ...keys: string[]): string => {
  return `${type}-${keys.join('.')}`
}

const fetchDataSource = async (source: string): Promise<any> => {
  try {
    const url = new URL(source, window.location.href)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const response = await window.fetch(source)
      return await response.json()
    }
  } catch {}

  const type = await queryPathType(source)
  switch (type) {
    case null:
      throw new Error(`bad source (not exists): "${source}"`)
    case 'file':
      const content = await readFile(source)
      if (!content) {
        throw new Error(`cannot fetch valid content from "${source}"`)
      }
      const c = content as string
      switch (pathSuffix(source)) {
        case 'json':
          return JSON.parse(c)
        case 'yml':
        case 'yaml':
          return yamlParse(c)
        default:
          throw new Error(`cannot resolve valid object from ${source}`)
      }
    case 'directory':
      const entries = await listEntries(source)
      const filenames = entries.map((e) => e.name)
      return filenames
  }
}

const updateBindTarget = (
  cacheKey: string,
  setFunc: ArgumentSetter,
  mobj: Module,
  target: string,
  value: Argument['value'],
) => {
  if (value === null) {
    return
  }
  const [akey, ...attrPath] = target.split('.')
  if (attrPath.length === 0) {
    return
  }

  let indexMap = argIndexCache.get(cacheKey)
  if (!indexMap) {
    indexMap = new Map()
    mobj.arguments?.forEach((arg, idx) => {
      indexMap!.set(arg.key, idx)
    })
    argIndexCache.set(cacheKey, indexMap)
  }

  const aIndex = indexMap.get(akey)
  if (aIndex === undefined) {
    return
  }

  const propKey = attrPath.join('.') as keyof Argument
  setFunc(aIndex, propKey, value)
}

const parseByFromRule = (data: any, rule: string | undefined): any => {
  if (typeof data !== 'object' || !rule) {
    return data
  }
  const match = rule.match(argFromRE)
  if (!match) {
    return data
  }

  const [pre, main, suf] = match.slice(1)
  if (!pre) {
    return _.get(data, main)
  }

  if (pre.slice(-1) !== '(' || suf[0] !== ')') {
    console.error(`parseByFromRule: rule${rule} is invalid for data`, data)
    return null
  }
  const func = pre.slice(0, -1)
  const tail = suf.slice(1)
  let result = parseByFromRule(data, main)
  if (func in funcMapping) {
    result = funcMapping[func](result)
  }
  if (tail) {
    result = _.get(result, tail.replace(/^\.+/, ''))
  }
  return result
}

const applyBindValue = async (
  cacheKey: string,
  setFunc: ArgumentSetter,
  mobj: Module,
  vb: VariedBind,
  refValue: any,
) => {
  try {
    let value = refValue
    if (!vb.isDirect) {
      if (typeof value !== 'string') {
        throw new Error(`${value}, type ${typeof value}, is not a valid url/filepath`)
      }
      value = await fetchDataSource(value)
    }
    value = parseByFromRule(value, vb.valuePath)
    updateBindTarget(cacheKey, setFunc, mobj, vb.destAttr, value)
  } catch (error) {
    console.warn(`[DynamicBind] Failed to apply bind:`, error)
  }
}

const resolveRefValue = (
  key: string,
  attr: string,
  mobj: Module,
  meta?: ModuleMeta,
  subMeta?: ModuleMeta,
): any => {
  const localArg = mobj.arguments?.find((arg) => arg.key === key)
  if (localArg) {
    const result = _.get(localArg, attr)
    if (result !== undefined) {
      return result
    }
  }

  if (subMeta && key in subMeta) {
    const metaArg = subMeta[key]
    const result = _.get(metaArg, attr)
    if (result !== undefined) {
      return result
    }
  }

  if (meta && key in meta) {
    const metaArg = meta[key]
    const result = _.get(metaArg, attr)
    if (result !== undefined) {
      return result
    }
  }

  console.warn(`[DynamicBind] Key "${key}" not found in any scope (arguments/subMeta/meta)`)
  return undefined
}

const initDynamicBinds = async (
  cacheKey: string,
  setFunc: ArgumentSetter,
  mobj: Module,
  meta?: ModuleMeta,
  subMeta?: ModuleMeta,
) => {
  if (!mobj.dynamicBind) {
    return
  }
  const aMap = new Map<string, VariedBind[]>()
  const handleDefiniteBind = async (bind: DynamicBind) => {
    try {
      const data = await fetchDataSource(bind.from)
      if (!data) {
        return
      }

      const value = parseByFromRule(data, bind.fromRule)
      updateBindTarget(cacheKey, setFunc, mobj, bind.to, value)
    } catch (error) {
      console.warn(`[DynamicBind] Failed to init bind from "${bind.from}":`, error)
    }
  }

  for (const bind of mobj.dynamicBind) {
    const match = bind.from.match(fromRE)

    if (!match) {
      await handleDefiniteBind(bind)
      continue
    }

    const isDirect = match[1] !== '{{'
    const refPath = match[2]!
    const [key, ...attrParts] = refPath.split('.')
    const attr = attrParts.join('.')

    if (!key || !attr) {
      continue
    }

    const [targetKey] = bind.to.split('.')
    const isValidTarget = mobj.arguments?.some((arg) => arg.key === targetKey)
    if (!isValidTarget) {
      console.warn(`[DynamicBind] Invalid target "${bind.to}", must be a module argument`)
      continue
    }

    const parsed: VariedBind = {
      isDirect,
      refKey: key,
      srcAttr: attr,
      valuePath: bind.fromRule,
      destAttr: bind.to,
    }

    const refValue = resolveRefValue(key, attr, mobj, meta, subMeta)
    if (refValue !== undefined) {
      await applyBindValue(cacheKey, setFunc, mobj, parsed, refValue)
    }

    if (!aMap.has(key)) {
      aMap.set(key, [])
    }
    aMap.get(key)!.push(parsed)
  }

  variedBindCache.set(cacheKey, aMap)
}

const resolveDynamicBinds = async (
  cacheKey: string,
  setFunc: ArgumentSetter,
  mobj: Module,
  aobj: Argument,
  changedKeys: string[],
  meta?: ModuleMeta,
  subMeta?: ModuleMeta,
) => {
  const bindMap = variedBindCache.get(cacheKey)
  if (!bindMap) {
    return
  }
  const variedBinds = bindMap.get(aobj.key)
  if (!variedBinds) {
    return
  }

  for (const vb of variedBinds) {
    if (!changedKeys.includes(vb.srcAttr)) {
      continue
    }

    const refValue = resolveRefValue(vb.refKey, vb.srcAttr, mobj, meta, subMeta)
    if (refValue !== undefined) {
      await applyBindValue(cacheKey, setFunc, mobj, vb, refValue)
    }
  }
}

export default {
  uniqueKey,
  init: initDynamicBinds,
  update: resolveDynamicBinds,
}
