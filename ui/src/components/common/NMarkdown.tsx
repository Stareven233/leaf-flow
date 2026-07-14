import { Component, createMemo } from 'solid-js'
import './NMarkdown.css'

export type NMarkdownTheme = 'light' | 'dark'

interface NMarkdownProps {
  content: string
  preserveBlankLines?: boolean
  theme?: NMarkdownTheme
}

const RE_BLANK_LINE = /^\s*$/
const RE_FENCE_START = /^```([\w-]*)\s*$/
const RE_FENCE_END = /^```\s*$/
const RE_HEADING = /^(#{1,6})(?:[ \t]+)?(.+)$/
const RE_HR = /^\s*([-*_])\1{2,}\s*$/
const RE_BLOCKQUOTE = /^>\s?/
const RE_UNORDERED_LIST = /^\s*[-*+]\s+.+$/
const RE_ORDERED_LIST = /^\s*\d+\.\s+.+$/
const RE_INLINE_CODE = /`([^`\n]+)`/g
const RE_LINK = /\[([^\]]+)\]\(([^)]+)\)/g
const RE_STRIKE = /~~(.+?)~~/g
const RE_BOLD_STAR = /\*\*(.+?)\*\*/g
const RE_ITALIC_STAR = /\*([^*\n]+)\*/g
const RE_HARD_BREAK = / {2,}$/

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderInline = (raw: string) => {
  let text = escapeHtml(raw)
  const inlineCode: string[] = []

  text = text.replace(RE_INLINE_CODE, (_, code: string) => {
    const token = `INLINECODE${inlineCode.length}`
    inlineCode.push(`<code>${code}</code>`)
    return token
  })

  text = text.replace(RE_LINK, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  text = text.replace(RE_STRIKE, '<del>$1</del>')
  text = text.replace(RE_BOLD_STAR, '<strong>$1</strong>')
  text = text.replace(RE_ITALIC_STAR, '<em>$1</em>')

  inlineCode.forEach((code, index) => {
    text = text.replace(`INLINECODE${index}`, code)
  })

  return text
}

const renderParagraph = (lines: string[]) => {
  const segments: string[] = []

  lines.forEach((line, index) => {
    const hardBreak = RE_HARD_BREAK.test(line)
    const cleanLine = line.replace(RE_HARD_BREAK, '')
    segments.push(renderInline(cleanLine))

    if (index < lines.length - 1) {
      segments.push(hardBreak ? '<br>' : ' ')
    }
  })

  return `<p>${segments.join('')}</p>`
}

const isFenceStart = (line: string) => RE_FENCE_START.test(line)
const isHeading = (line: string) => RE_HEADING.test(line)
const isHr = (line: string) => RE_HR.test(line)
const isBlockquote = (line: string) => RE_BLOCKQUOTE.test(line)
const isUnorderedList = (line: string) => RE_UNORDERED_LIST.test(line)
const isOrderedList = (line: string) => RE_ORDERED_LIST.test(line)
const isBlockStart = (line: string) =>
  isFenceStart(line) ||
  isHeading(line) ||
  isHr(line) ||
  isBlockquote(line) ||
  isUnorderedList(line) ||
  isOrderedList(line)

export const NMarkdown: Component<NMarkdownProps> = (props) => {
  const html = createMemo(() => {
    const preserveBlankLines = props.preserveBlankLines !== false
    const source = (props.content || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u2028|\u2029/g, '\n')
      .replace(/\\n/g, '\n')
    const lines = source.split('\n')
    const blocks: string[] = []

    let i = 0
    while (i < lines.length) {
      const line = lines[i]

      if (RE_BLANK_LINE.test(line)) {
        if (!preserveBlankLines) {
          i += 1
          continue
        }

        let blankCount = 0
        while (i < lines.length && RE_BLANK_LINE.test(lines[i])) {
          blankCount += 1
          i += 1
        }

        for (let j = 1; j < blankCount; j += 1) {
          blocks.push('<br>')
        }
        continue
      }

      const fence = line.match(RE_FENCE_START)
      if (fence) {
        const language = fence[1] || 'text'
        const codeLines: string[] = []
        i += 1

        while (i < lines.length && !RE_FENCE_END.test(lines[i])) {
          codeLines.push(lines[i])
          i += 1
        }

        if (i < lines.length && RE_FENCE_END.test(lines[i])) {
          i += 1
        }

        blocks.push(
          `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`,
        )
        continue
      }

      const heading = line.match(RE_HEADING)
      if (heading) {
        const level = heading[1].length
        blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
        i += 1
        continue
      }

      if (isHr(line)) {
        blocks.push('<hr>')
        i += 1
        continue
      }

      if (isBlockquote(line)) {
        const quoteLines: string[] = []
        while (i < lines.length && isBlockquote(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''))
          i += 1
        }
        blocks.push(`<blockquote>${quoteLines.map(renderInline).join('<br>')}</blockquote>`)
        continue
      }

      if (isUnorderedList(line)) {
        const items: string[] = []
        while (i < lines.length && isUnorderedList(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
          i += 1
        }
        blocks.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
        continue
      }

      // Ordered list.
      if (isOrderedList(line)) {
        const items: string[] = []
        while (i < lines.length && isOrderedList(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
          i += 1
        }
        blocks.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`)
        continue
      }

      const paragraphLines: string[] = []
      while (i < lines.length && !RE_BLANK_LINE.test(lines[i]) && !isBlockStart(lines[i])) {
        paragraphLines.push(lines[i])
        i += 1
      }
      blocks.push(renderParagraph(paragraphLines))
    }

    return blocks.join('\n')
  })

  return (
    <section
      class="n-markdown"
      classList={{
        'n-markdown--dark': props.theme === 'dark',
        'n-markdown--light': props.theme !== 'dark',
      }}
      innerHTML={html()}
    />
  )
}

export default NMarkdown
