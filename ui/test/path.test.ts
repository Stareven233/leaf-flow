import { describe, expect, test } from 'bun:test'
import Path, * as path from '../src/utils/path'

describe('path utils', () => {
  test('函数式 API 与类实例 API 保持一致', () => {
    const target = 'foo//bar/../baz.ts'
    const p = new Path(target)

    expect(path.normalize(target)).toBe('foo/baz.ts')
    expect(p.normalize()).toBe('foo/baz.ts')
    expect(path.split(target)).toEqual(['foo', 'baz.ts'])
    expect(p.split()).toEqual(['foo', 'baz.ts'])
    expect(path.suffix(target)).toBe('ts')
    expect(p.suffix()).toBe('ts')
    expect(path.suffixes('archive.tar.gz')).toEqual(['tar', 'gz'])
    expect(p.join('../qux')).toBe('foo/qux')
  })

  test('join 会忽略空片段并保留相对回退语义', () => {
    expect(path.join('', 'foo', '.', 'bar', '..', 'baz')).toBe('foo/baz')
    expect(path.join('..', 'foo', '..', 'bar')).toBe('../bar')
  })

  test('normalize 兼容绝对路径与盘符路径', () => {
    expect(path.normalize('/foo//bar/../baz')).toBe('/foo/baz')
    expect(path.normalize('C:\\foo\\bar\\..\\baz')).toBe('C:/foo/baz')
  })
})
