import yaml from 'yaml'
import type { Project, Module, Argument, Flow, ModuleMeta } from '@/types/project'
import _ from 'lodash'
import { normalizeMeta } from './metaHelper'

export const parseProjects = (names: string[], yamlStrings: string[]): (Project | null)[] => {
  const projects: (Project | null)[] = []
  if (yamlStrings.length === 0) {
    return projects
  }

  for (let i = 0; i < yamlStrings.length; i++) {
    const str = yamlStrings[i]!
    try {
      const p = yaml.parse(str)
      p.key = names[i]
      if (!p.name) {
        p.name = p.key
      }
      if (p.meta) {
        p.meta = normalizeMeta(p.meta)
      }
      projects.push(p)
    } catch (e) {
      projects.push(null)
      console.error(`Loading project <${names[i]}>`, e)
    }
  }
  return projects
}

export const mergeProjects = (base: Project | null, patches: Object[]): Project | null => {
  if (!base) {
    return null
  }

  for (let p of patches) {
    if (!p) {
      continue
    }
    if (typeof p === 'string') {
      p = yaml.parse(p)
    }
    mergeProject(base, p)
  }
  return base
}

const mergeProject = (base: Project, patch: any) => {
  for (const key in patch) {
    const k = key as keyof Project
    if (k === 'modules') {
      continue
    }
    const val = patch[k]
    if (base[k] === val) {
      continue
    }
    if (val !== undefined) {
      base[k] = val
    }
  }

  if (!base.modules || !patch.modules) {
    return
  }
  for (const bModule of base.modules) {
    const pModule = patch.modules.find((m: any) => m.key === bModule.key)
    if (!pModule) {
      continue
    }
    mergeModule(bModule, pModule)
  }
}

const mergeModule = (base: Module, patch: any) => {
  for (const key in patch) {
    const k = key as keyof Module
    if (k === 'arguments') {
      continue
    }
    const val = patch[k]
    if (base[k] === val) {
      continue
    }
    if (val !== undefined) {
      ;(base as any)[k] = val
    }
  }

  if (!base.arguments || !patch.arguments) {
    return
  }
  for (const bArgument of base.arguments) {
    const patchArg = patch.arguments.find((a: any) => a.key === bArgument.key)
    if (!patchArg) {
      continue
    }
    mergeArgument(bArgument, patchArg)
  }
}

const mergeArgument = (base: Argument, patch: any) => {
  for (const key in patch) {
    const k = key as keyof Argument
    const val = patch[k]
    if (base[k] === val) {
      continue
    }
    if (val !== undefined) {
      ;(base as any)[k] = val
    }
  }
}

export const toYaml = (project: Project): string => {
  return yaml.stringify(project, {
    indent: 2,
    simpleKeys: true,
  })
}

export const exportFile = (name: string, content: string): void => {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading YAML config:', error)
  }
}

export const parseFlows = (names: string[], yamlStrings: string[]): (Flow | null)[] => {
  const flows: (Flow | null)[] = []
  if (yamlStrings.length === 0) {
    return flows
  }

  for (let i = 0; i < yamlStrings.length; i++) {
    const str = yamlStrings[i]!
    const yamlName = names[i]!
    try {
      const f = yaml.parse(str)
      f.key = yamlName
      if (!f.branches) {
        f.branches = []
      }
      if (!f.name) {
        f.name = f.key
      }
      if (f.meta) {
        f.meta = normalizeMeta(f.meta)
      }
      f.branches.forEach((b: Project) => {
        if (!b.name) {
          b.name = b.key
        }
        if (b.meta) {
          b.meta = normalizeMeta(b.meta)
        }
      })
      flows.push(f)
    } catch (e) {
      flows.push(null)
      console.error(`Loading flow <${yamlName}>`, e)
    }
  }
  return flows
}

const resolveModuleMeta = (mod: Module, pmeta?: ModuleMeta): ModuleMeta => {
  const mmeta: ModuleMeta = {}
  const akeys = new Set(mod.arguments?.map((a) => a.key) || [])

  if (!pmeta) {
    return mmeta
  }

  const templates = Array.isArray(mod.template) ? mod.template : [mod.template]
  const regex = /#\{([^#{}]+)\}/g

  let match
  for (const t of templates) {
    match = null
    while ((match = regex.exec(t)) !== null) {
      const key = match[1]!
      if (!akeys.has(key) && key in pmeta) {
        mmeta[key] = pmeta[key]!
      }
    }
  }

  return mmeta
}

export const resolveFlowBranch = async (
  branch: Project,
  getProject: (name: string) => Promise<Project | null>,
): Promise<Project> => {
  const branchMeta: ModuleMeta = {}

  const modules = await Promise.all(
    branch.modules.map(async (mod, index) => {
      if (!mod.key) {
        throw new Error(`${index}th mod in ${branch.key} has no key!`)
      }

      const dotIndex = mod.key.indexOf('.')
      if (dotIndex === -1) {
        return mod
      }
      const pkey = mod.key.slice(0, dotIndex)
      const mkey = mod.key.slice(dotIndex + 1)

      const p = await getProject(pkey!)
      if (!p) {
        console.error(`Project '${pkey}' not found for flow mod reference`)
        return mod
      }

      const sMod = p.modules.find((m) => m.key === mkey)
      if (!sMod) {
        console.error(`Module '${mkey}' not found in project '${pkey}'`)
        return mod
      }

      const rMod: Module = _.cloneDeep(sMod)
      const _overrideFields = [
        'name',
        'desc',
        'template',
        'shell',
        'disabled',
        'dynamicBind',
      ] as const
      for (const _field of _overrideFields) {
        const val = (mod as any)[_field]
        if (val !== undefined) {
          ;(rMod as any)[_field] = val
        }
      }

      if (mod.arguments && mod.arguments.length > 0) {
        if (!rMod.arguments) {
          rMod.arguments = []
        }
        for (const a of mod.arguments) {
          const i = rMod.arguments.findIndex((ra) => ra.key === a.key)
          if (i !== -1) {
            mergeArgument(rMod.arguments[i]!, a)
            continue
          }
          rMod.arguments.push(_.cloneDeep(a))
        }
      }

      const moduleMeta = resolveModuleMeta(rMod, p.meta)
      Object.assign(branchMeta, moduleMeta)

      return rMod
    }),
  )

  const usedKeys = new Set<string>()
  const keyCount = new Map<string, number>()
  const uniqueModules = modules.map((mod) => {
    const baseKey = mod.key
    if (!baseKey) {
      return mod
    }
    if (!usedKeys.has(baseKey)) {
      usedKeys.add(baseKey)
      keyCount.set(baseKey, 1)
      return mod
    }
    let count = keyCount.get(baseKey) ?? 1
    let newKey = baseKey
    do {
      count += 1
      newKey = `${baseKey}#${count}`
    } while (usedKeys.has(newKey))
    keyCount.set(baseKey, count)
    usedKeys.add(newKey)
    return { ...mod, key: newKey }
  })

  Object.assign(branchMeta, branch.meta)
  return { ...branch, modules: uniqueModules, meta: branchMeta }
}
