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

export const uploadTempFiles = (
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    if (files.length === 0) {
      resolve([])
      return
    }

    const url = `${API_BASE_KEY}/upload`
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText)
          if (resp.success && Array.isArray(resp.data)) {
            resolve(resp.data)
            return
          }
          reject(new Error(resp.message || '上传失败'))
        } catch (err) {
          reject(err)
        }
      } else {
        try {
          const resp = JSON.parse(xhr.responseText)
          reject(new Error(resp.message || `上传失败 (HTTP ${xhr.status})`))
        } catch {
          reject(new Error(`上传失败 (HTTP ${xhr.status})`))
        }
      }
    }

    xhr.onerror = () => {
      reject(new Error('上传遇到网络错误'))
    }

    xhr.send(formData)
  })
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
