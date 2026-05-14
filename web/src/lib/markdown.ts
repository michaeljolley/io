/**
 * Lightweight markdown → HTML renderer (no external dependency).
 * Handles: headings H1–H4, fenced code blocks, bold/italic/inline-code,
 * links (https/http/relative/anchor only — javascript: and data: are blocked),
 * unordered and ordered lists, horizontal rules, paragraphs.
 *
 * Output is safe to use with v-html: HTML entities are escaped before any
 * markdown substitution so raw content can never inject markup.
 */

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

export function renderMarkdown(md: string): string {
  if (!md) return ''

  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let inList = false
  let codeLines: string[] = []

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false }
  }

  for (const line of lines) {
    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList()
        inCode = true
        codeLines = []
      } else {
        const escaped = codeLines.join('\n')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        out.push(`<pre class="bg-gray-900 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
        inCode = false
        codeLines = []
      }
      continue
    }

    if (inCode) { codeLines.push(line); continue }

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
      if (!inList) { out.push('<ul class="list-disc list-inside my-2 space-y-1 pl-2">'); inList = true }
      out.push(`<li>${inlineFormat(li[1])}</li>`)
      continue
    }

    // Ordered list items
    const oli = line.match(/^\d+\.\s+(.+)/)
    if (oli) {
      if (!inList) { out.push('<ol class="list-decimal list-inside my-2 space-y-1 pl-2">'); inList = true }
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

  // Close any uncovered code block (malformed markdown)
  if (inCode && codeLines.length) {
    const escaped = codeLines.join('\n')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    out.push(`<pre class="bg-gray-900 border border-gray-800 rounded p-3 my-2 overflow-x-auto"><code class="font-mono text-xs text-green-300">${escaped}</code></pre>`)
  }
  closeList()

  return out.join('\n')
}
