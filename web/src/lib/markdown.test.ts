/**
 * Tests for web/src/lib/markdown.ts — the custom markdown renderer.
 *
 * Run via: npm test --prefix web
 * The css-noop-register.mjs loader intercepts highlight.js CSS imports
 * so the renderer can be imported in a plain Node.js test environment.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown, extractFrontmatter } from './markdown.js'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Assert that output contains a substring. */
function contains(html: string, substring: string, msg?: string) {
  assert.ok(html.includes(substring), msg ?? `Expected HTML to contain: ${substring}\nActual: ${html}`)
}

/** Assert that output does NOT contain a substring. */
function notContains(html: string, substring: string, msg?: string) {
  assert.ok(!html.includes(substring), msg ?? `Expected HTML NOT to contain: ${substring}\nActual: ${html}`)
}

// ── renderMarkdown — empty/trivial ────────────────────────────────────────────

describe('renderMarkdown — empty input', () => {
  it('returns empty string for empty input', () => {
    assert.equal(renderMarkdown(''), '')
  })

  it('returns empty string for falsy input', () => {
    assert.equal(renderMarkdown(''), '')
  })
})

// ── headings ──────────────────────────────────────────────────────────────────

describe('renderMarkdown — headings', () => {
  it('renders h1', () => {
    const html = renderMarkdown('# Hello World')
    contains(html, '<h1 ')
    contains(html, 'Hello World')
    contains(html, '</h1>')
  })

  it('renders h2', () => {
    const html = renderMarkdown('## Section Title')
    contains(html, '<h2 ')
    contains(html, 'Section Title')
    contains(html, '</h2>')
  })

  it('renders h3', () => {
    const html = renderMarkdown('### Sub Section')
    contains(html, '<h3 ')
    contains(html, 'Sub Section')
  })

  it('renders h4', () => {
    const html = renderMarkdown('#### Sub-sub')
    contains(html, '<h4 ')
    contains(html, 'Sub-sub')
  })
})

// ── inline formatting ─────────────────────────────────────────────────────────

describe('renderMarkdown — inline formatting', () => {
  it('renders bold', () => {
    const html = renderMarkdown('**bold text**')
    contains(html, '<strong>bold text</strong>')
  })

  it('renders italic', () => {
    const html = renderMarkdown('*italic text*')
    contains(html, '<em>italic text</em>')
  })

  it('renders bold+italic', () => {
    const html = renderMarkdown('***both***')
    contains(html, '<strong><em>both</em></strong>')
  })

  it('renders inline code', () => {
    const html = renderMarkdown('Use `const x = 1` here')
    contains(html, '<code ')
    contains(html, 'const x = 1')
  })

  it('escapes HTML entities in inline content', () => {
    const html = renderMarkdown('Use <b>raw</b> & "quotes"')
    contains(html, '&lt;b&gt;')
    contains(html, '&amp;')
    notContains(html, '<b>')
  })
})

// ── links ─────────────────────────────────────────────────────────────────────

describe('renderMarkdown — links', () => {
  it('renders https links', () => {
    const html = renderMarkdown('[GitHub](https://github.com)')
    contains(html, '<a href="https://github.com"')
    contains(html, 'GitHub')
  })

  it('renders relative links', () => {
    const html = renderMarkdown('[Home](/)')
    contains(html, '<a href="/"')
  })

  it('renders anchor links', () => {
    const html = renderMarkdown('[Section](#section)')
    contains(html, '<a href="#section"')
  })

  it('blocks javascript: URLs', () => {
    const html = renderMarkdown('[Click](javascript:alert(1))')
    contains(html, 'href="#"')
    notContains(html, 'javascript:')
  })

  it('blocks data: URLs', () => {
    const html = renderMarkdown('[Data](data:text/html,<h1>)')
    contains(html, 'href="#"')
  })
})

// ── fenced code blocks ────────────────────────────────────────────────────────

describe('renderMarkdown — fenced code blocks', () => {
  it('renders a fenced code block with pre+code elements', () => {
    // highlight.js tokenises content into <span> tags so we check for
    // structural elements, not literal content strings.
    const html = renderMarkdown('```\nconst x = 1\n```')
    contains(html, '<pre ')
    contains(html, '<code ')
    notContains(html, '```')
  })

  it('renders language label for named fenced code block', () => {
    // Language name appears in a <span> overlay in the rendered output.
    const html = renderMarkdown('```typescript\nconst x: number = 1\n```')
    contains(html, 'typescript')
    contains(html, '<code ')
  })

  it('escapes HTML in code blocks via hljs span wrapping', () => {
    // highlight.js escapes < and > inside span elements.
    const html = renderMarkdown('```\n<script>alert(1)</script>\n```')
    // The raw <script> tag must not appear unescaped in the output.
    notContains(html, '<script>')
    contains(html, '&lt;')
  })

  it('renders unclosed code block at EOF', () => {
    const html = renderMarkdown('```\nsome code without closing fence')
    contains(html, 'some code without closing fence')
  })
})

// ── blockquotes ───────────────────────────────────────────────────────────────

describe('renderMarkdown — blockquotes', () => {
  it('treats > prefix as plain text (blockquotes not implemented in this renderer)', () => {
    // The renderer does not have a blockquote handler; > lines are rendered
    // as paragraphs with the > entity-escaped. This test documents current behavior.
    const html = renderMarkdown('> This is a quote')
    contains(html, '&gt;')
    contains(html, 'This is a quote')
  })
})

// ── unordered lists ───────────────────────────────────────────────────────────

describe('renderMarkdown — unordered lists', () => {
  it('renders - list items in <ul>', () => {
    const html = renderMarkdown('- item one\n- item two')
    contains(html, '<ul ')
    contains(html, '<li>item one</li>')
    contains(html, '<li>item two</li>')
    contains(html, '</ul>')
  })

  it('renders * list items', () => {
    const html = renderMarkdown('* alpha\n* beta')
    contains(html, '<ul ')
    contains(html, 'alpha')
    contains(html, 'beta')
  })

  it('renders + list items', () => {
    const html = renderMarkdown('+ one\n+ two')
    contains(html, '<ul ')
    contains(html, 'one')
    contains(html, 'two')
  })

  it('closes <ul> not <ol>', () => {
    const html = renderMarkdown('- item\n\nnext paragraph')
    contains(html, '</ul>')
    notContains(html, '</ol>')
  })
})

// ── ordered lists ─────────────────────────────────────────────────────────────

describe('renderMarkdown — ordered lists', () => {
  it('renders ordered list with <ol>', () => {
    const html = renderMarkdown('1. first\n2. second\n3. third')
    contains(html, '<ol ')
    contains(html, '<li>first</li>')
    contains(html, '<li>second</li>')
    contains(html, '</ol>')
  })

  it('auto-increments with repeated "1." markers (regression: issue #240)', () => {
    const html = renderMarkdown('1. alpha\n1. beta\n1. gamma')
    contains(html, '<ol ')
    contains(html, '<li>alpha</li>')
    contains(html, '<li>beta</li>')
    contains(html, '<li>gamma</li>')
    contains(html, '</ol>')
    // Critically: must NOT use </ul> to close an ordered list
    notContains(html, '</ul>')
  })

  it('closes <ol> not <ul>', () => {
    const html = renderMarkdown('1. item\n\nnext')
    contains(html, '</ol>')
    notContains(html, '</ul>')
  })

  it('switches from ol to ul correctly', () => {
    const html = renderMarkdown('1. ordered\n\n- unordered')
    contains(html, '<ol ')
    contains(html, '</ol>')
    contains(html, '<ul ')
    contains(html, '</ul>')
  })
})

// ── horizontal rules ──────────────────────────────────────────────────────────

describe('renderMarkdown — horizontal rules', () => {
  it('renders --- as <hr>', () => {
    const html = renderMarkdown('---')
    contains(html, '<hr ')
  })

  it('renders ---- as <hr>', () => {
    const html = renderMarkdown('----')
    contains(html, '<hr ')
  })
})

// ── tables ────────────────────────────────────────────────────────────────────

describe('renderMarkdown — tables', () => {
  it('renders a GFM table', () => {
    const html = renderMarkdown('| Name | Age |\n|------|-----|\n| Alice | 30 |\n| Bob | 25 |')
    contains(html, '<table')
    contains(html, '<th ')
    contains(html, 'Name')
    contains(html, 'Age')
    contains(html, '<td ')
    contains(html, 'Alice')
    contains(html, 'Bob')
    contains(html, '</table>')
  })

  it('renders right-aligned column from ---:', () => {
    const html = renderMarkdown('| Val |\n| ---: |\n| 42 |')
    contains(html, 'text-right')
  })

  it('renders center-aligned column from :---:', () => {
    const html = renderMarkdown('| Val |\n| :---: |\n| 42 |')
    contains(html, 'text-center')
  })
})

// ── blank lines / paragraphs ──────────────────────────────────────────────────

describe('renderMarkdown — paragraphs', () => {
  it('wraps plain text in <p>', () => {
    const html = renderMarkdown('Hello world')
    contains(html, '<p ')
    contains(html, 'Hello world')
    contains(html, '</p>')
  })

  it('emits spacer div for blank lines', () => {
    const html = renderMarkdown('line one\n\nline two')
    contains(html, '<div class="my-2">')
  })
})

// ── mixed content ─────────────────────────────────────────────────────────────

describe('renderMarkdown — mixed content', () => {
  it('handles heading followed by list', () => {
    const html = renderMarkdown('## Steps\n1. Install\n2. Run')
    contains(html, '<h2 ')
    contains(html, '<ol ')
    contains(html, '</ol>')
  })

  it('handles code block followed by paragraph', () => {
    const html = renderMarkdown('```\ncode\n```\n\nAfter code')
    contains(html, 'code')
    contains(html, 'After code')
  })
})

// ── extractFrontmatter ────────────────────────────────────────────────────────

describe('extractFrontmatter', () => {
  it('returns null frontmatter for non-frontmatter content', () => {
    const { frontmatter, body } = extractFrontmatter('# Hello')
    assert.equal(frontmatter, null)
    assert.equal(body, '# Hello')
  })

  it('parses simple key: value frontmatter', () => {
    const { frontmatter, body } = extractFrontmatter('---\ntitle: My Title\nauthor: Test\n---\nBody here')
    assert.ok(frontmatter)
    assert.equal(frontmatter['title'], 'My Title')
    assert.equal(frontmatter['author'], 'Test')
    assert.equal(body.trim(), 'Body here')
  })

  it('strips surrounding quotes from values', () => {
    const { frontmatter } = extractFrontmatter('---\ntitle: "Quoted"\n---\n')
    assert.equal(frontmatter?.['title'], 'Quoted')
  })

  it('returns null for unclosed frontmatter', () => {
    const { frontmatter } = extractFrontmatter('---\ntitle: Test\n')
    assert.equal(frontmatter, null)
  })
})
