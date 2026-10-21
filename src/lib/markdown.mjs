import { marked, Renderer } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { withBase } from './paths.mjs';

export function renderMarkdown(text, transformPath = withBase) {
  const renderer = new Renderer();
  const seen = new Map();
  renderer.heading = function ({ tokens, depth }) {
    const html = this.parser.parseInline(tokens);
    const label = html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '').trim();
    const base = label.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'section';
    const count = seen.get(base) || 0; seen.set(base, count + 1);
    return `<h${depth} id="${base}${count ? `-${count}` : ''}">${html}</h${depth}>\n`;
  };
  return sanitizeHtml(/^\s*</.test(text) ? text : marked.parse(text, { async: false, renderer }), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'details', 'summary']),
    allowedAttributes: { '*': ['id'], ol: ['start'], td: ['colspan','rowspan'], th: ['colspan','rowspan','scope'], a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, ...(attrs.href ? { href: transformPath(attrs.href) } : {}), rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { ...attrs, ...(attrs.src ? { src: transformPath(attrs.src) } : {}), loading: 'lazy' } }),
    },
  });
}

export function articleHeadings(html) {
  return [...html.matchAll(/<h([23])\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map(([,depth,id,title]) => ({depth:Number(depth),id,title:sanitizeHtml(title,{allowedTags:[],allowedAttributes:{}})}));
}
