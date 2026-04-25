export type OneOrMany<T> = T | T[]

export type ArgumentValue = number | string | boolean
export type ArgumentDType = 'string' | 'number' | 'file' | 'directory' | 'boolean'
export type ArgumentMethod = 'input' | 'slide' | 'radio' | 'select' | 'mmap' | 'switch'

export interface Argument {
  key: string
  name: string
  desc?: string
  dtype?: ArgumentDType
  method?: ArgumentMethod
  value?: OneOrMany<ArgumentValue>
  required?: boolean
  template?: string
  multiple?: boolean
  dir?: string
  min?: number
  max?: number
  step?: number
  options?: ArgumentValue[]
}

export type ArgumentSetter = (aIndex: number, key: keyof Argument, value: Argument['value']) => void

export type RawModuleMeta = Record<string, ArgumentValue | Partial<Argument>>
export type ModuleMeta = Record<string, Argument>

export interface Project {
  key: string
  name: string
  desc?: string
  meta?: ModuleMeta
  modules: Module[]
}

export interface DynamicBind {
  from: string
  fromRule?: string
  to: string
}

export interface Module {
  key: string
  name: string
  desc?: string
  template: string | string[]
  shell?: string
  arguments?: Argument[]
  disabled?: boolean
  dynamicBind?: DynamicBind[]
}

export interface Flow {
  key: string
  name: string
  desc?: string
  meta?: ModuleMeta
  branches: Project[]
}

export interface RenderStatus {
  rawValue?: OneOrMany<ArgumentValue>
  value?: OneOrMany<ArgumentValue>
  preRendered: boolean
  [key: string]: OneOrMany<ArgumentValue> | boolean | undefined
}
export type ArgumentMap = Record<string, OneOrMany<ArgumentValue> | undefined>
export type ArgumentRenderMap = Record<string, RenderStatus>

export type EntryType = 'project' | 'flow'
export interface SavedArgument {
  type: EntryType
  key: string
  subKey: string
  map: ArgumentMap | Record<string, ArgumentMap>
}
