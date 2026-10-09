import { describe, expect, test } from 'bun:test'
import { BIG_NUMBER } from '../src/utils/constants'
import { isPinned, matchName, nextOpenMTime } from '../src/utils/homeList'

describe('isPinned', () => {
  test('mtime 低于 BIG_NUMBER 时为 false', () => {
    expect(isPinned(Date.now())).toBe(false)
    expect(isPinned(0)).toBe(false)
    expect(isPinned(BIG_NUMBER - 1)).toBe(false)
  })

  test('mtime 达到或超过 BIG_NUMBER 时为 true', () => {
    expect(isPinned(BIG_NUMBER)).toBe(true)
    expect(isPinned(BIG_NUMBER + Date.now())).toBe(true)
  })
})

describe('nextOpenMTime', () => {
  test('未置顶时写裸时间戳', () => {
    const before = Date.now()
    const next = nextOpenMTime(1_700_000_000_000)
    const after = Date.now()
    expect(next).toBeGreaterThanOrEqual(before)
    expect(next).toBeLessThanOrEqual(after)
    expect(isPinned(next)).toBe(false)
  })

  test('已置顶时写 Date.now()+BIG_NUMBER，保持置顶', () => {
    const before = Date.now()
    const next = nextOpenMTime(BIG_NUMBER + 1_700_000_000_000)
    const after = Date.now()
    expect(isPinned(next)).toBe(true)
    expect(next).toBeGreaterThanOrEqual(before + BIG_NUMBER)
    expect(next).toBeLessThanOrEqual(after + BIG_NUMBER)
  })
})

describe('matchName', () => {
  test('空串 / 全空格不过滤（恒 true）', () => {
    expect(matchName('demo', '')).toBe(true)
    expect(matchName('demo', '   ')).toBe(true)
  })

  test('大小写不敏感子串匹配 stem', () => {
    expect(matchName('MyDemo', 'demo')).toBe(true)
    expect(matchName('MyDemo', 'MY')).toBe(true)
    expect(matchName('MyDemo', 'xyz')).toBe(false)
  })

  test('多词 AND；多空格等同单空格', () => {
    expect(matchName('demo-build-app', 'demo build')).toBe(true)
    expect(matchName('demo-build-app', 'demo  build')).toBe(true)
    expect(matchName('demo-app', 'demo build')).toBe(false)
  })

  test('可选已加载展示名：stem 或 name 任一命中即可', () => {
    expect(matchName('stem-a', '展示', '展示名')).toBe(true)
    expect(matchName('stem-a', 'stem', '展示名')).toBe(true)
    expect(matchName('stem-a', 'missing', '展示名')).toBe(false)
  })
})
