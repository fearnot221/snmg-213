import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { selectPublishedPosts, validateSettings } from './schema.mjs';
export { categories, validatePost, validateSettings, selectPublishedPosts } from './schema.mjs';

export function getSettings() {
  return validateSettings(JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/settings.json'), 'utf8')));
}
/** @returns {import('./schema.mjs').Post[]} */
export function getPosts() {
  const folder = join(process.cwd(), 'src/content/posts');
  const posts = readdirSync(folder).filter(file => file.endsWith('.json')).map(file => ({ ...JSON.parse(readFileSync(join(folder, file), 'utf8')), file }));
  return selectPublishedPosts(posts);
}
export { renderMarkdown } from './markdown.mjs';
export const formatDate = date => date.replaceAll('-', '.');

export function getMembers() {
  const folder=join(process.cwd(),'src/content/members');
  return readdirSync(folder).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(readFileSync(join(folder,file),'utf8')))
    .sort((a,b)=>a.slug.localeCompare(b.slug));
}
export function getSchedule() {return JSON.parse(readFileSync(join(process.cwd(),'src/content/site/schedule.json'),'utf8'));}
export function getLegacyPages() {
  const folder=join(process.cwd(),'src/content/legacy');
  return readdirSync(folder).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(readFileSync(join(folder,file),'utf8')));
}
export function getTaxonomies(kind) {
  if(kind==='categories')return [...new Set(getPosts().map(post=>post.category))];
  return [...new Set(getPosts().flatMap(post=>post.tags||[]))];
}

export function taxonomySlug(value) {return value.toLowerCase().replace(/[\s_]+/g,'-');}
