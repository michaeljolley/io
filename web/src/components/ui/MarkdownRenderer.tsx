import DOMPurify from "isomorphic-dompurify";
import { marked, Renderer } from "marked";
import React, { useMemo } from "react";

const renderer = new Renderer();

renderer.link = (linkData): string => {
  const { href, title, text } = linkData;
  const titleAttr = title ? ` title="${title}"` : "";

  // External links (http/https) get target="_blank" and rel="noopener noreferrer"
  if (href && /^https?:\/\//i.test(href)) {
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  }

  return `<a href="${href}"${titleAttr}>${text}</a>`;
};

marked.use({ renderer });

function sanitizeHtml(markdown: string) {
  const html = marked.parse(markdown) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });
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
