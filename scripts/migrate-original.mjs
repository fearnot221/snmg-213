import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseDocument } from 'htmlparser2';
import { findAll, findOne, textContent, getInnerHTML } from 'domutils';
const origin = 'https://snmg.ce.ncu.edu.tw';
const curl = url => execFileSync('curl', ['--fail','-Ls','--retry','2','--max-time','25',decodeURI(url)], { maxBuffer: 10_000_000, encoding:'utf8' });
const sitemap = curl(`${origin}/sitemap.xml`);
const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([,xml]) => ({ url:xml.match(/<loc>(.*?)<\/loc>/)[1], date:xml.match(/<lastmod>(.*?)<\/lastmod>/)?.[1]?.slice(0,10) || null }));
const manifest = [];
const assets = new Map();
mkdirSync('migration/cache',{recursive:true});mkdirSync('src/content/members',{recursive:true});mkdirSync('src/content/legacy',{recursive:true});mkdirSync('public/images/original',{recursive:true});
const hasClass = (node, value) => node.attribs?.class?.split(/\s+/).includes(value);
const nodes = (root, tag) => findAll(n=>n.type==='tag' && n.name===tag,root.children||[]);
function asset(src) {
  const url = new URL(src,origin);
  if (url.origin !== origin) return src;
  if (assets.has(url.href)) return assets.get(url.href);
  const extension = url.pathname.match(/\.[a-z0-9]+$/i)?.[0] || '.bin';
  const local = `/images/original/${createHash('sha256').update(url.href).digest('hex').slice(0,16)}${extension}`;
  if (!existsSync(`public${local}`)) execFileSync('curl',['--fail','-Ls','--retry','2','--max-time','25',decodeURI(url.href),'-o',`public${local}`]);
  assets.set(url.href,local);return local;
}
function clean(node) {
  for (const item of [node,...findAll(()=>true,node.children||[])]) {
    if (!item.attribs) continue;
    if (item.name==='img' && item.attribs.src) {item.attribs.src=asset(item.attribs.src);delete item.attribs.srcset;item.attribs.loading='lazy';}
    if(item.name==='a' && item.attribs.href?.startsWith(origin)) {const u=new URL(item.attribs.href);item.attribs.href=decodeURI(u.pathname)+u.search+u.hash;}
  }
  return getInnerHTML(node,{encodeEntities:'utf8'}).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--([\s\S]*?)-->/g,'').trim();
}
for (const entry of entries) {
  const path=decodeURI(new URL(entry.url).pathname);
  const cache=`migration/cache/${createHash('sha256').update(path).digest('hex')}.html`;
  const html=existsSync(cache)?readFileSync(cache,'utf8'):curl(entry.url);
  if(!existsSync(cache))writeFileSync(cache,html);
  const document=parseDocument(html);
  const main=findOne(n=>n.name==='main',document.children);
  if(!main)throw new Error(`Missing main content: ${path}`);
  const title=textContent(findOne(n=>n.name==='h1',main.children)||findOne(n=>n.name==='h2',main.children)||main).trim();
  const content=findOne(n=>hasClass(n,'content'),main.children);
  const record={path,title,source:entry.url,date:entry.date};
  if(/^\/announcements\/.+\/$/.test(path)) {
    if(!content)throw new Error(`Missing article: ${path}`);
    const file=`src/content/posts/${path.split('/').filter(Boolean).at(-1)}.json`;
    const old=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
    const categories=nodes(main,'a').filter(n=>n.attribs.href?.startsWith('/categories/')).map(n=>textContent(n).trim());
    const tags=nodes(main,'a').filter(n=>n.attribs.href?.startsWith('/tags/')).map(n=>textContent(n).trim());
    const authorLink=findOne(n=>n.name==='a'&&n.attribs.href?.includes('/members/'),main.children);
    const data={...old,title,slug:path.split('/').filter(Boolean).at(-1),category:categories[0]||old.category||'公告',body:clean(content),date:entry.date,published:true,pinned:false,source:entry.url,sourceType:'full',tags:[...new Set(tags)],author:authorLink?decodeURI(authorLink.attribs.href).replace(origin,''):null};
    if(!data.summary)data.summary=textContent(content).replace(/\s+/g,' ').slice(0,150);
    writeFileSync(file,JSON.stringify(data,null,2)+'\n');record.kind='article';
  } else if(/^\/members\/.+\/$/.test(path)) {
    const img=nodes(main,'img')[0];
    const attributes=findOne(n=>hasClass(n,'member-attributes'),main.children);
    const social=findOne(n=>hasClass(n,'social-icons'),main.children);
    const links=social?nodes(social,'a').map(n=>n.attribs.href).filter(Boolean):[];
    const data={slug:path.split('/').filter(Boolean).at(-1),name:title,attributes:attributes?textContent(attributes).trim().replace(/\s+/g,' '):'',body:content?clean(content):'',image:img?asset(img.attribs.src):'',links,source:entry.url};
    writeFileSync(`src/content/members/${data.slug}.json`,JSON.stringify(data,null,2)+'\n');record.kind='member';
  } else if(path==='/sched/') {
    const table=findOne(n=>n.name==='table',main.children);
    const rows=table?nodes(table,'tr').map(row=>nodes(row,'td').length?nodes(row,'td').map(cell=>({text:textContent(cell).trim().replace(/\s+/g,' '),members:nodes(cell,'a').map(a=>({name:textContent(a).trim(),href:decodeURI(a.attribs.href).replace(origin,'')}))})):[]):[];
    const data={updated:entry.date,rows:rows.filter(row=>row.length),source:entry.url};
    writeFileSync('src/content/site/schedule.json',JSON.stringify(data,null,2)+'\n');record.kind='schedule';
  } else if(['/privacy-policy/','/elements/','/pages/'].includes(path)) {
    const data={title,path,body:content?clean(content):'',source:entry.url};
    writeFileSync(`src/content/legacy/${path.split('/')[1]}.json`,JSON.stringify(data,null,2)+'\n');record.kind='legacy';
  } else if(path.startsWith('/categories/')||path.startsWith('/tags/')) { record.kind='taxonomy'; }
  else record.kind='page';
  manifest.push(record);console.log(record.kind,path);
}
writeFileSync('migration/routes.json',JSON.stringify(manifest,null,2)+'\n');
writeFileSync('migration/assets.json',JSON.stringify([...assets].map(([source,path])=>({source,path})),null,2)+'\n');
console.log(`Migrated ${manifest.length} routes and ${assets.size} assets.`);
