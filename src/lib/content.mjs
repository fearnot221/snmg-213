import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { withBase } from './paths.mjs';

/** @typedef {{file:string,title:string,slug:string,category:string,summary:string,body:string,date:string,published:boolean,pinned:boolean,source?:string,order?:number}} Post */

export const categories = ['公告', '教學文件', '機房日誌', '招募資訊'];
function requiredString(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} 必須是 1–${max} 字的文字。`);
}
function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
function httpsUrl(value, name) {
  try { if (new URL(value).protocol === 'https:') return; } catch {}
  throw new Error(`${name} 必須是 HTTPS 網址。`);
}
/** @param {Post} post */
export function validatePost(post) {
  for (const [field, max] of Object.entries({ title: 100, slug: 120, summary: 300, body: 50000 })) requiredString(post[field], field, max);
  if (!/^[\p{L}\p{N}_-]+$/u.test(post.slug)) throw new Error('文章網址只能使用文字、數字、連字號與底線。');
  if (!categories.includes(post.category)) throw new Error('無效的文章分類。');
  if (!validDate(post.date)) throw new Error('無效的發布日期。');
  if (typeof post.published !== 'boolean' || typeof post.pinned !== 'boolean') throw new Error('公開與置頂欄位必須是布林值。');
  if (post.source) httpsUrl(post.source, '原文來源');
  return post;
}
export function validateSettings(settings) {
  for (const [field, max] of Object.entries({ heroTitle: 24, heroDescription: 240, aboutText: 1000, recruitmentText: 1000, email: 120, officeHours: 120, phone: 80 })) requiredString(settings[field], field, max);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) throw new Error('聯絡信箱格式錯誤。');
  for (const key of ['networkForm', 'mailForm', 'dnsForm']) httpsUrl(settings[key], key);
  return settings;
}
export function getSettings() {
  return validateSettings(JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/settings.json'), 'utf8')));
}
/** @param {Post[]} posts */
export function selectPublishedPosts(posts, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })) {
  const slugs = new Set();
  for (const post of posts) {
    validatePost(post);
    if (slugs.has(post.slug)) throw new Error(`重複的文章網址：${post.slug}`);
    slugs.add(post.slug);
  }
  return posts.filter(p => p.published && p.date <= today)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date) || (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug));
}
/** @returns {Post[]} */
export function getPosts() {
  const folder = join(process.cwd(), 'src/content/posts');
  const posts = readdirSync(folder).filter(file => file.endsWith('.json')).map(file => ({ ...JSON.parse(readFileSync(join(folder, file), 'utf8')), file }));
  return selectPublishedPosts(posts);
}
export function renderMarkdown(text) {
  return sanitizeHtml(marked.parse(text, { async: false }), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: { a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, ...(attrs.href ? { href: withBase(attrs.href) } : {}), rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { ...attrs, ...(attrs.src ? { src: withBase(attrs.src) } : {}), loading: 'lazy' } }),
    },
  });
}
export const formatDate = date => date.replaceAll('-', '.');
