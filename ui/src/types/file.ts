export interface DirEntry {
  name: string
  path: string
  isDir: boolean
  size?: number
  mtime: number
}

export interface Config {
  version: string
  host: string
  port: number
  isDev: boolean
  uiDir: string
  budDir: string
  openBrowser: boolean
  progressSampleGap: number
  mmapMarker: string
  mmapSize?: number
  logDir?: string
  [key: string]: any
}
