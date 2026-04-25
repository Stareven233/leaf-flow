import type { Project, Flow } from '@/types/project'
import type { Config } from '@/types/file'
import { API_BASE_KEY } from '@/utils/constants'
import { toYaml, parseProjects, mergeProjects, parseFlows } from '@/utils/config'

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  return response.json()
}

export const fetchConfig = async (): Promise<Config> => {
  const url = `${API_BASE_KEY}/config`
  const resp = await fetchJson(url)
  if (resp.success && resp.data) {
    return resp.data
  } else if (resp.version !== undefined) {
    return resp as Config
  }
  throw new Error(`cannot fetch config from '${url}'`)
}

export const fetchBaseProject = async (names: string[]): Promise<(Project | null)[]> => {
  const resp = await fetchJson(`${API_BASE_KEY}/projects?name=${names.join('|')}`)
  return resp.success ? parseProjects(names, resp.data) : []
}

export const fetchProject = async (name: string, patches?: string[]): Promise<Project | null> => {
  let url = `${API_BASE_KEY}/projects?name=${name}`
  if (patches && patches.length > 0) {
    url += `&patches=${patches.join('|')}`
  }
  try {
    const resp = await fetchJson(url)
    if (resp.success) {
      const base = parseProjects([name], resp.data.slice(0, 1))[0] || null
      return mergeProjects(base, resp.data.slice(1))
    }
  } catch (error) {
    console.error(`Loading project <${name}>`, error)
  }
  return null
}

export const saveProject = async (project: Project, name?: string): Promise<boolean> => {
  const url = `${API_BASE_KEY}/projects`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name || project.key,
        content: toYaml(project),
      }),
    })
    if (response.status !== 200) {
      return false
    }
    const resp = await response.json()
    return resp.success
  } catch (error) {
    console.error('Saving project', error)
    return false
  }
}

export const fetchBaseFlow = async (names: string[]): Promise<(Flow | null)[]> => {
  const flowNames = names.map((n) => `${n}${n.endsWith('.flow') ? '' : '.flow'}`)
  try {
    const resp = await fetchJson(`${API_BASE_KEY}/projects?base=sprig&name=${flowNames.join('|')}`)
    if (resp.success) {
      return parseFlows(names, resp.data)
    }
  } catch (error) {
    console.error('Loading flows', error)
  }
  return []
}

export const fetchFlow = async (name: string): Promise<Flow | null> => {
  const result = await fetchBaseFlow([name])
  return result[0] || null
}
