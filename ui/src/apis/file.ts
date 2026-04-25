import type { DirEntry } from '@/types/file'
import { API_BASE_KEY } from '@/utils/constants'
import * as pUtil from '@/utils/path'

export const absolutePath = async (path: string): Promise<string> => {
  const url = `${API_BASE_KEY}/path-absolute?path=${encodeURIComponent(path)}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const resp = await response.json()
    if (resp.success) {
      return resp.data
    }
  } catch (error) {
    console.error(`Getting absolute path for <${path}>`, error)
  }
  return path
}

export const listEntries = async (dir: string): Promise<DirEntry[]> => {
  dir = await pUtil.resolve(dir)
  const url = `${API_BASE_KEY}/directory?path=${encodeURIComponent(dir)}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const resp = await response.json()
    if (resp.success) {
      return resp.data.map((entry: DirEntry) => ({
        ...entry,
        mtime: entry.mtime ? new Date(entry.mtime) : undefined,
      }))
    }
  } catch (error) {
    console.error(`Loading entries <${dir}>`, error)
  }
  return []
}

export const readFile = async (
  path: string,
  type: 'text' | 'blob' = 'text',
): Promise<string | Blob | null> => {
  path = await pUtil.resolve(path)
  const url = `${API_BASE_KEY}/file?path=${encodeURIComponent(path)}`
  try {
    const response = await fetch(url, {
      method: 'GET',
    })
    if (response.ok) {
      const p = type === 'text' ? response.text() : response.blob()
      return await p
    }
  } catch (error) {
    console.warn(`Reading file "${path}"`, error)
  }
  return null
}

export const createEntry = async (
  path: string,
  isDir: boolean,
  content?: string,
  overwritten: boolean = false,
): Promise<boolean> => {
  const url = `${API_BASE_KEY}/directory`
  path = await pUtil.resolve(path)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, isDir, content, overwritten }),
    })
    const resp = await response.json()
    return resp.success
  } catch (error) {
    console.error(`Creating ${isDir ? 'directory' : 'file'} <${path}>`, error)
    return false
  }
}

export const queryPathType = async (path: string): Promise<'file' | 'directory' | null> => {
  path = await pUtil.resolve(path)
  const url = `${API_BASE_KEY}/path-type?path=${encodeURIComponent(path)}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const resp = await response.json()
    if (resp.success) {
      return resp.data ?? null
    }
  } catch (error) {
    console.error(`Checking path type for <${path}>`, error)
  }
  return null
}
