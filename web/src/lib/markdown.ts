/**
 * Lightweight markdown → HTML renderer (no external dependency).
 * Handles: headings H1–H4, fenced code blocks, bold/italic/inline-code,
 * links (https/http/relative/anchor only — javascript: and data: are blocked),
 * unordered and ordered lists, horizontal rules, GFM tables, paragraphs.
 *
 * Output is safe to use with v-html: HTML entities are escaped before any
 * markdown substitution so raw content can never inject markup.
 */

import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import 'highlight.js/styles/github-dark.css'

// Register only the languages we need to keep bundle size reasonable
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

function inlineFormat(text: string): string {
  return text
    // Escape HTML entities first — must happen before any tag insertion
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // bold + italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-blue-300 font-mono text-xs">$1</code>')
    // links — only http/https/relative/anchor allowed (blocks javascript:, data:, etc.)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
      const safe = /^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('#')
      return `<a href="${safe ? url : '#'}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">${linkText}</a>`
    })
}

/** Returns true if the line looks like a table row (has at least one | inside). */
function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.length > 2
}

/** Returns true if the line is a table separator row (---|:---:|---: etc.). */
function isSeparatorRow(line: string): boolean {
  return isTableRow(line) && /^\|[\s|:\-]+\|$/.test(line.trim())
}

/** Split a table row string into trimmed cell strings (excludes empty outer cells). */
function splitRow(line: string): string[] {
  return line.trim().slice(1, -1).split('|').map(c => c.trim())
}

/** Parse alignment from a separator cell: ':---' → left, ':---:' → center, '---:' → right. */
function parseAlign(sep: string): string {
  const s = sep.trim()
  if (s.startsWith(':') && s.endsWith(':')) return 'text-center'
  if (s.endsWith(':')) return 'text-right'
  return 'text-left'
}

/** Render a buffered block of table lines as an HTML table. */
function renderTable(tableLines: string[]): string {
  if (tableLines.length < 2) return tableLines.map(l => `<p class="my-1">${inlineFormat(l)}</p>`).join('\n')

  const headers = splitRow(tableLines[0])
  const sepLine = tableLines[1]
  const alignments = isSeparatorRow(sepLine)
    ? splitRow(sepLine).map(parseAlign)
    : headers.map(() => 'text-left')
  const dataRows = isSeparatorRow(sepLine) ? tableLines.slice(2) : tableLines.slice(1)

  const thCells = headers.map((h, i) => {
    const align = alignments[i] ?? 'text-left'
    return `<th class="px-3 py-1.5 font-medium text-gray-300 ${align}">${inlineFormat(h)}</th>`
  }).join('')

  const tbodyRows = dataRows.map(row => {
    const cells = splitRow(row)
    const tds = headers.map((_, i) => {
      const align = alignments[i] ?? 'text-left'
      return `<td class="px-3 py-1.5 text-gray-400 ${align}">${inlineFormat(cells[i] ?? '')}</td>`
    }).join('')
    return `<tr class="border-b border-gray-800">${tds}</tr>`
  }).join('')

  return `<div class="overflow-x-auto my-2"><table class="border-collapse w-full text-sm"><thead><tr class="border-b border-gray-700">${thCells}</tr></thead><tbody>${tbodyRows}</tbody></table></div>`
}


/**
 * Extract YAML frontmatter from a markdown string.
 * Detects content between opening `---` and closing `---` fences at the start of the file.
 * Parses simple `key: value` pairs — no full YAML library needed for SKILL.md files.
 * Handles quoted values (single or double quotes) and empty values.
 */
export function extractFrontmatter(md: string): { frontmatter: Record<string, string> | null; body: string } {
  if (!md.startsWith('---\n') && md !== '---') {
    return { frontmatter: null, body: md }
  }
  // Find the closing fence: a `---` on its own line after the opening
  const closeIdx = md.indexOf('\n---\n', 3)
  const closeIdxEof = md.indexOf('\n---', 3)
  const end = (closeIdx !== -1) ? closeIdx : (closeIdxEof !== -1 && md.slice(closeIdxEof).trimEnd() === '---' ? closeIdxEof : -1)
  if (end === -1) return { frontmatter: null, body: md }

  const yamlBlock = md.slice(4, end) // everything between the two fences
  const body = (closeIdx !== -1) ? md.slice(closeIdx + 5) : ''

  const frontmatter: Record<string, string> = {}
  for (const line of yamlBlock.split('\n')) {
    const m = line.match(/^([^:]+):\s*(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let value = m[2].trim()
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    frontmatter[key] = value
  }

  return {
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null,
    body,
  }
}

export function renderMarkdown(md: string): string {
  if (!md) return ''

  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let listType: 'ul' | 'ol' | null = null
  let inTable = false
  let codeLines: string[] = []
  let codeLang = ''
  let tableLines: string[] = []

  function closeList() {
    if (listType) { out.push(`</${listType}>`); listType = null }
  }

  function closeTable() {
    if (inTable) {
      out.push(renderTable(tableLines))
      tableLines = []
      inTable = false
    }
  }

  for (const line of lines) {
    // Fenced code blocks
    if (line.startsWith('```')) {
      closeList()
      closeTable()
      if (!inCode) {
        inCode = true
        codeLang = line.slice(3).trim().split(/\s+/)[0].toLowerCase()
        codeLines = []
      } else {
        const raw = codeLines.join('\n')
        let highlighted: string
        try {
          highlighted = codeLang && hljs.getLanguage(codeLang)
            ? hljs.highlight(raw, { language: codeLang, ignoreIllegals: true }).value
            : hljs.highlightAuto(raw).value
        } catch {
          highlighted = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
        const safeLang = codeLang.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const langLabel = safeLang ? `<span class="text-[10px] text-txt-muted font-mono absolute top-2 right-3 select-none">${safeLang}</span>` : ''
        out.push(`<div class="relative my-2"><pre class="bg-surface-1 border border-edge rounded-xl p-3 overflow-x-auto"><code class="hljs font-mono text-xs">${highlighted}</code></pre>${langLabel}</div>`)
        inCode = false
        codeLang = ''
        codeLines = []
      }
      continue
    }

    if (inCode) { codeLines.push(line); continue }

    // Table rows — buffer until a non-table line appears
    if (isTableRow(line)) {
      closeList()
      inTable = true
      tableLines.push(line)
      continue
    }

    // Non-table line while buffering a table → flush it
    if (inTable) closeTable()

    // Headings
    const h4 = line.match(/^####\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h4) { closeList(); out.push(`<h4 class="text-sm font-semibold text-gray-200 mt-4 mb-1">${inlineFormat(h4[1])}</h4>`); continue }
    if (h3) { closeList(); out.push(`<h3 class="text-base font-semibold text-gray-100 mt-5 mb-2">${inlineFormat(h3[1])}</h3>`); continue }
    if (h2) { closeList(); out.push(`<h2 class="text-lg font-bold text-gray-100 mt-6 mb-2 pb-1 border-b border-gray-800">${inlineFormat(h2[1])}</h2>`); continue }
    if (h1) { closeList(); out.push(`<h1 class="text-xl font-bold text-gray-100 mt-6 mb-3">${inlineFormat(h1[1])}</h1>`); continue }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr class="border-gray-800 my-4" />'); continue }

    // Unordered list items
    const li = line.match(/^[-*+]\s+(.+)/)
    if (li) {
      if (listType === 'ol') closeList()
      if (!listType) { out.push('<ul class="list-disc list-inside my-2 space-y-1 pl-2">'); listType = 'ul' }
      out.push(`<li>${inlineFormat(li[1])}</li>`)
      continue
    }

    // Ordered list items
    const oli = line.match(/^\d+\.\s+(.+)/)
    if (oli) {
      if (listType === 'ul') closeList()
      if (!listType) { out.push('<ol class="list-decimal list-inside my-2 space-y-1 pl-2">'); listType = 'ol' }
      out.push(`<li>${inlineFormat(oli[1])}</li>`)
      continue
    }

    // Blank line
    if (line.trim() === '') {
      closeList()
      out.push('<div class="my-2"></div>')
      continue
    }

    closeList()
    out.push(`<p class="my-1">${inlineFormat(line)}</p>`)
  }

  // Flush any open blocks at EOF
  if (inCode && codeLines.length) {
    const escaped = codeLines.join('\n')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out.push(`<pre class="bg-gray-900 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
  }
  closeTable()
  closeList()

  return out.join('\n')
}
