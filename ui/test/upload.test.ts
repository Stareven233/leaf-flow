import { describe, expect, test } from 'bun:test'
import type { ArgumentDType } from '../src/types/project'

export const parseMethods = (method?: string): string[] => {
  return (method || '')
    .split(/[|,]/)
    .map((m) => {
      const item = m.trim().toLowerCase()
      return item === 'uplaod' ? 'upload' : item
    })
    .filter(Boolean)
}

export const supportsMmap = (dtype?: ArgumentDType, methods: string[] = []): boolean => {
  return dtype === 'file' && methods.includes('mmap')
}

export const supportsSelect = (methods: string[] = [], isMmapEnabled: boolean = false): boolean => {
  return (methods.length === 0 || methods.includes('select')) && !isMmapEnabled
}

export const supportsUpload = (
  dtype?: ArgumentDType,
  methods: string[] = [],
  isMmapEnabled: boolean = false,
): boolean => {
  return dtype === 'file' && methods.includes('upload') && !isMmapEnabled
}

describe('PathInput method 组合逻辑测试', () => {
  test('默认空配置：100% 向后兼容，仅开启 select，无上传与 mmap', () => {
    const methods = parseMethods(undefined)
    expect(methods).toEqual([])
    expect(supportsSelect(methods, false)).toBe(true)
    expect(supportsUpload('file', methods, false)).toBe(false)
    expect(supportsMmap('file', methods)).toBe(false)
  })

  test('显式 select 配置：仅开启宿主机文件选择', () => {
    const methods = parseMethods('select')
    expect(methods).toEqual(['select'])
    expect(supportsSelect(methods, false)).toBe(true)
    expect(supportsUpload('file', methods, false)).toBe(false)
  })

  test('混合模式：select|upload 与 select,upload 均支持宿主机选择与客户端上传', () => {
    for (const raw of ['select|upload', 'select,upload', ' upload | select ']) {
      const methods = parseMethods(raw)
      expect(supportsSelect(methods, false)).toBe(true)
      expect(supportsUpload('file', methods, false)).toBe(true)
    }
  })

  test('纯上传模式：upload 模式下隐藏宿主机选择与目录输入', () => {
    const methods = parseMethods('upload')
    expect(supportsSelect(methods, false)).toBe(false)
    expect(supportsUpload('file', methods, false)).toBe(true)
  })

  test('类型收敛：dtype 为 directory 时即使配置了 upload 也不生效', () => {
    const methods = parseMethods('select|upload')
    expect(supportsSelect(methods, false)).toBe(true)
    expect(supportsUpload('directory', methods, false)).toBe(false)
  })

  test('MMAP 互斥协同：当启用了 MMAP 时，同时收起 select 与 upload', () => {
    const methods = parseMethods('select|upload|mmap')
    expect(supportsMmap('file', methods)).toBe(true)
    expect(supportsSelect(methods, true)).toBe(false)
    expect(supportsUpload('file', methods, true)).toBe(false)
    expect(supportsSelect(methods, false)).toBe(true)
    expect(supportsUpload('file', methods, false)).toBe(true)
  })

  test('容错拼写失误：select|uplaod|mmap 自动兼容 uplaod 拼写错误并支持三种能力', () => {
    const methods = parseMethods('select|uplaod|mmap')
    expect(methods).toEqual(['select', 'upload', 'mmap'])
    expect(supportsMmap('file', methods)).toBe(true)
    expect(supportsSelect(methods, false)).toBe(true)
    expect(supportsUpload('file', methods, false)).toBe(true)
  })
})
