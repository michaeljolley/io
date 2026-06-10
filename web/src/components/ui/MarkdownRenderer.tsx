import hljs from "highlight.js/lib/common";
import DOMPurify from "isomorphic-dompurify";
import { marked, Renderer } from "marked";
import React, { useMemo } from "react";

if (typeof document !== "undefined") {
  import("highlight.js/styles/github-dark.css");
}

const renderer = new Renderer();

renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : "";

  if (href && /^https?:\/\//i.test(href)) {
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  }

  return `<a href="${href}"${titleAttr}>${text}</a>`;
};

renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted =
    language === "plaintext" ? hljs.highlightAuto(text).value : hljs.highlight(text, { language }).value;

  return `<pre class="overflow-x-auto rounded-md bg-zinc-950/90 p-4"><code class="hljs language-${language}">${highlighted}</code></pre>`;
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

  return React.createElement(
    React.Fragment,
    null,
    React.createElement("style", {
      dangerouslySetInnerHTML: {
        __html: `
          .markdown-renderer :where(h1, h2, h3, h4, h5, h6) {
            color: var(--base-pink) !important;
            font-weight: 700 !important;
          }
        `,
      },
    }),
    React.createElement("article", {
      className:
        `markdown-renderer prose prose-invert max-w-none prose-io text-sm leading-7 text-zinc-200 ${className}`.trim(),
      dangerouslySetInnerHTML: { __html: html },
    }),
  );
}
