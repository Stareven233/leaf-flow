const sep = '/'
const drivePattern = /^[A-Za-z]:/

const ensurePathValue = (path: string): string => path || '.'

const isAbsolutePath = (path: string): boolean => {
  const value = ensurePathValue(path)
  return value.startsWith('/') || drivePattern.test(value)
}

const normalizePath = (path: string): string => {
  const value = ensurePathValue(path)
  const isAbs = isAbsolutePath(value)
  const driveMatch = value.match(drivePattern)
  const pathWithoutDrive = driveMatch ? value.slice(2) : value
  const parts = pathWithoutDrive.split(/[/\\]+/).filter(Boolean)
  const stack: string[] = []

  for (const part of parts) {
    if (part === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop()
      } else if (!isAbs) {
        stack.push('..')
      }
    } else if (part !== '.') {
      stack.push(part)
    }
  }

  let result = stack.join(sep)

  if (isAbs) {
    if (value.startsWith('/')) {
      result = '/' + result
    } else if (driveMatch) {
      const drive = driveMatch[0]
      result = result ? `${drive}/${result}` : `${drive}/`
    }
  }

  return result || '.'
}

const splitPath = (path: string): [string, string] => {
  const normalized = normalizePath(path)
  const lastSlash = normalized.lastIndexOf('/')

  if (lastSlash === -1) {
    return ['.', normalized]
  }

  const dir = normalized.slice(0, lastSlash) || (normalized.startsWith('/') ? '/' : '.')
  const name = normalized.slice(lastSlash + 1)
  return [dir, name]
}

const joinPaths = (...paths: string[]): string => {
  const filtered = paths.map(ensurePathValue).filter((path) => path !== '.')
  if (filtered.length === 0) {
    return '.'
  }
  return normalizePath(filtered.join(sep))
}

const suffixPath = (path: string): string => {
  const value = ensurePathValue(path)
  const lastDotIndex = value.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return ''
  }
  return value.slice(lastDotIndex + 1)
}

const suffixesPath = (path: string): string[] => {
  const value = ensurePathValue(path)
  const parts = value.split('.')
  if (parts[0] === '') {
    parts.shift()
  }
  return parts.length > 1 ? parts.slice(1) : []
}

const resolvePath = async (path: string): Promise<string> => {
  const normalized = normalizePath(path)

  if (isAbsolutePath(path)) {
    return normalized
  }

  try {
    const { useConfigStore } = await import('@/stores/config')
    const root = await useConfigStore().rootDir()
    return joinPaths(root, normalized)
  } catch (error) {
    console.error(`Getting absolute path for <${normalized}>`, error)
    return normalized
  }
}

export class Path {
  private readonly value: string

  constructor(path: string) {
    this.value = ensurePathValue(path)
  }

  isAbsolute(): boolean {
    return isAbsolutePath(this.value)
  }

  normalize(): string {
    return normalizePath(this.value)
  }

  split(): [string, string] {
    return splitPath(this.value)
  }

  join(...paths: string[]): string {
    return joinPaths(this.value, ...paths)
  }

  suffix(): string {
    return suffixPath(this.value)
  }

  suffixes(): string[] {
    return suffixesPath(this.value)
  }

  async resolve(): Promise<string> {
    return resolvePath(this.value)
  }
}

export {
  isAbsolutePath as isAbsolute,
  normalizePath as normalize,
  splitPath as split,
  joinPaths as join,
  suffixPath as suffix,
  suffixesPath as suffixes,
  resolvePath as resolve,
}

export default Path
