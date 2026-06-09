import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./MarkdownRenderer";

function renderMarkdown(markdown: string) {
  return renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: markdown }));
}

test("MarkdownRenderer renders core markdown features", () => {
  const html = renderMarkdown(
    `# Title\n\n- one\n- two\n\n> quoted\n\n| A | B |\n|---|---|\n| x | y |\n\n\`\`\`js\nconst value = 1;\n\`\`\`\n\n[Example](https://example.com)`,
  );

  assert.match(html, /<h1[^>]*>Title<\/h1>/i);
  assert.match(html, /<ul[^>]*>/i);
  assert.match(html, /<li>one<\/li>/i);
  assert.match(html, /<blockquote[^>]*>/i);
  assert.match(html, /quoted/i);
  assert.match(html, /<table[^>]*>/i);
  assert.match(html, /<th[^>]*>A<\/th>/i);
  assert.match(html, /<code class="language-js"/i);
  assert.match(html, /<a href="https:\/\/example\.com"[^>]*>Example<\/a>/i);
});

test("MarkdownRenderer sanitizes XSS payloads", () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)"><a href="javascript:alert(1)">click</a>');

  assert.doesNotMatch(html, /onerror=/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /<img[^>]*src="x"/i);
});

test("MarkdownRenderer adds target=_blank and rel=noopener noreferrer to external links", () => {
  const html = renderMarkdown("[External](https://example.com) and [Internal](/page)");

  // External link (https) should have target="_blank" and rel="noopener noreferrer"
  assert.match(html, /<a href="https:\/\/example\.com" target="_blank" rel="noopener noreferrer">External<\/a>/);

  // Internal link should NOT have target or rel attributes
  assert.match(html, /<a href="\/page">Internal<\/a>/);
  assert.doesNotMatch(html, /<a href="\/page"[^>]*target/);
});

test("MarkdownRenderer handles http links as external", () => {
  const html = renderMarkdown("[HTTP Link](http://example.com)");

  assert.match(html, /<a href="http:\/\/example\.com" target="_blank" rel="noopener noreferrer">HTTP Link<\/a>/);
});
