import { BIG_NUMBER } from '@/utils/constants'

export function isPinned(mtime: number): boolean {
  return mtime >= BIG_NUMBER
}

export function nextOpenMTime(currentMtime: number): number {
  const now = Date.now()
  return isPinned(currentMtime) ? now + BIG_NUMBER : now
}

export function matchName(stem: string, query: string, loadedDisplayName?: string): boolean {
  const q = query.trim()
  if (q === '') {
    return true
  }
  const tokens = q.split(/\s+/).filter(Boolean)
  const candidates = [stem, loadedDisplayName]
    .filter((s): s is string => !!s)
    .map((s) => s.toLowerCase())
  return tokens.every((token) => {
    const t = token.toLowerCase()
    return candidates.some((c) => c.includes(t))
  })
}
