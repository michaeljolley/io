import hljs from 'highlight.js/lib/core';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import 'highlight.js/styles/github-dark-dimmed.min.css';
import { marked, type Token } from 'marked';
import { useMemo } from 'react';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('bash', shell);
hljs.registerLanguage('sh', shell);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

marked.use({
	renderer: {
		heading({ tokens, depth }: { tokens: Token[]; depth: number }) {
			const text = tokens.map((t) => t.raw).join('');
			const tag = `h${depth}`;
			const sizes: Record<number, string> = {
				1: '2em',
				2: '1.65em',
				3: '1.35em',
				4: '1.15em',
			};
			return `<${tag} style="background:linear-gradient(135deg, #D83333 0%, #E43A9C 50%, #F041FF 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:${sizes[depth] ?? '1em'};font-weight:600;margin:1.1em 0 0.4em;line-height:1.4;text-transform:none;">${text}</${tag}>`;
		},
		code({ text, lang }: { text: string; lang?: string }) {
			let highlighted: string;
			if (lang && hljs.getLanguage(lang)) {
				highlighted = hljs.highlight(text, { language: lang }).value;
			} else {
				highlighted = hljs.highlightAuto(text).value;
			}
			return `<pre style="background:#161616;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:0.9em 1.1em;overflow-x:auto;margin:0.8em 0;"><code class="hljs" style="background:none;border:none;padding:0;color:#d4d4d8;font-size:0.85em;">${highlighted}</code></pre>`;
		},
	},
});

/** Pre-configured marked instance — import this instead of 'marked' directly */
export { marked as configuredMarked };

export function MarkdownRenderer({
	content,
	className = '',
}: { content: string; className?: string }) {
	const html = useMemo(() => marked.parse(content) as string, [content]);
	return (
		<div
			className={`prose-io ${className}`}
			style={{ color: '#d4d4d8', fontSize: '0.875rem', lineHeight: '1.7' }}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
