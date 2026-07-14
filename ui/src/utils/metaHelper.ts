import type {
  Argument,
  ArgumentValue,
  ArgumentDType,
  ModuleMeta,
  RawModuleMeta,
} from '@/types/project'

export const normalizeMetaValue = (
  key: string,
  value: ArgumentValue | Partial<Argument>,
): Argument => {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const partialArg = value as Partial<Argument>
    return {
      ...partialArg,
      key: partialArg.key || key,
      name: partialArg.name || partialArg.key || key,
    } as Argument
  }

  const inferType = (val: ArgumentValue): ArgumentDType => {
    switch (typeof val) {
      case 'boolean':
        return 'boolean'
      case 'number':
        return 'number'
      default:
        return 'string'
    }
  }

  return {
    key,
    name: key,
    value: value as ArgumentValue,
    dtype: inferType(value as ArgumentValue),
  }
}

export const metaToArguments = (meta?: ModuleMeta): Argument[] => {
  if (!meta) {
    return []
  }
  return Object.entries(meta).map(([key, value]) => normalizeMetaValue(key, value))
}

export const normalizeMeta = (meta?: RawModuleMeta): ModuleMeta => {
  if (!meta) {
    return {}
  }
  const normalized: ModuleMeta = {}
  for (const [key, value] of Object.entries(meta)) {
    normalized[key] = normalizeMetaValue(key, value)
  }
  return normalized
}

export const argumentToMetaValue = (arg: Argument): ArgumentValue | Argument => {
  const hasExtendedFields = !!(
    arg.desc ||
    arg.method ||
    arg.required ||
    arg.template ||
    arg.multiple ||
    arg.dir ||
    arg.min !== undefined ||
    arg.max !== undefined ||
    arg.step !== undefined ||
    arg.options
  )

  if (hasExtendedFields) {
    const { key, ...rest } = arg
    return rest as Argument
  }

  const value = arg.value
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}
