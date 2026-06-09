import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import React, { useMemo } from "react";

function sanitizeHtml(markdown: string) {
  const html = marked.parse(markdown) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const html = useMemo(() => sanitizeHtml(content), [content]);

  return React.createElement("article", {
    className: `prose prose-invert max-w-none prose-io text-sm leading-7 text-zinc-200 ${className}`.trim(),
    dangerouslySetInnerHTML: { __html: html },
  });
}
